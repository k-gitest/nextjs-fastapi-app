import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// B2はS3互換APIを提供しているため、標準のS3 SDKで扱う。
// エンドポイント・リージョンはBackblazeアカウント作成時に確定する値。
//
// 注意: 環境変数はモジュールトップレベルでは読まない。
// import時点ではloadEnvConfig()等がまだ実行されていない可能性があり、
// トップレベルで読むと空文字列のまま固定されてしまう問題があった。
// 代わりにgetB2Config() / getB2Client()内で、実際にB2操作が必要になった
// タイミングで読み取り・検証する（Lazy Singleton）。

type B2Config = {
  endpoint: string;
  region: string;
  bucket: string;
  keyId: string;
  applicationKey: string;
};

let cachedConfig: B2Config | null = null;
let cachedClient: S3Client | null = null;

/**
 * B2操作に必要な環境変数を取得・検証する（内部関数）。
 * 呼び出し時点のprocess.envを読むため、モジュール評価タイミングに依存しない。
 * 初回呼び出し時のみ検証を行い、以降はcacheした値を返す。
 *
 * B2_REGIONのみデフォルト値（"us-west-000"）を持つため必須検証の対象外とする。
 */
function getB2Config(): B2Config {
  if (cachedConfig) return cachedConfig;

  const endpoint = process.env.B2_ENDPOINT ?? "";
  const bucket = process.env.B2_BUCKET ?? "";
  const keyId = process.env.B2_KEY_ID ?? "";
  const applicationKey = process.env.B2_APPLICATION_KEY ?? "";
  const region = process.env.B2_REGION ?? "us-west-000";

  const missing: string[] = [];
  if (!endpoint) missing.push("B2_ENDPOINT");
  if (!bucket) missing.push("B2_BUCKET");
  if (!keyId) missing.push("B2_KEY_ID");
  if (!applicationKey) missing.push("B2_APPLICATION_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required B2 environment variables: ${missing.join(", ")}`);
  }

  cachedConfig = { endpoint, region, bucket, keyId, applicationKey };
  return cachedConfig;
}

/**
 * S3ClientのLazy Singleton。
 * 初回呼び出し時にgetB2Config()で検証済みの設定からClientを生成し、以降は再利用する。
 *
 * 現時点でプロダクションコードからの直接利用箇所はなく、この関数を経由する
 * createPresignedPutUrl等の内部利用に限定される想定（テストでのインスタンス同一性
 * 検証のためexportしている）。
 */
export function getB2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const config = getB2Config();
  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
    },
    // B2のS3互換APIはpath-style URLを要求する
    forcePathStyle: true,
  });
  return cachedClient;
}

const PRESIGNED_PUT_EXPIRES_SECONDS = 5 * 60; // 5分
const PRESIGNED_GET_EXPIRES_SECONDS = 5 * 60; // 5分

/**
 * アップロード用のオブジェクトキーをサーバー側で生成する。
 * クライアントに生成させない（パストラバーサル・namespace衝突対策）。
 *
 * storageKeyはB2上のopaqueなオブジェクト識別子であり、所有権・分類情報を含めない
 * （Image所有権はImage.userIdのみが情報源。README.md「Image Ownership Principle」参照）。
 * 旧フォーマット（uploads/YYYY/MM/DD/{Auth0 sub}/{uuid}.ext）はAuth0 subを含んでいたため
 * Sentryのデータスクラビングでb2_object_pathが[Filtered]になる問題があった。
 * 新フォーマットではAuth0 sub・日付ディレクトリを廃止し、単純なuuidベースのキーにする
 * （GC基盤の導入に伴うstorageKey命名規則の再設計。詳細はREADME.md「ADR: storageKey
 * 命名規則の変更とGC基盤の導入」参照）。
 *
 * 例: uploads/{uuid}.jpg
 */
export const buildStorageKey = (uuid: string, extension: string): string => {
  return `uploads/${uuid}.${extension}`;
};

/**
 * アップロード用のPresigned PUT URLを発行する。
 * Content-Typeを署名に含めることで、指定したMIMEタイプ以外でのPUTを拒否させる。
 */
export const createPresignedPutUrl = async (storageKey: string, mimeType: string): Promise<string> => {
  const client = getB2Client();
  const { bucket } = getB2Config();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: mimeType,
  });

  return getSignedUrl(client, command, { expiresIn: PRESIGNED_PUT_EXPIRES_SECONDS });
};

/**
 * 表示用のPresigned GET URLを発行する（バケットがallPrivateのため）。
 * Route Handlerでこれを取得し、302 Redirectでブラウザへ渡す想定。
 */
export const createPresignedGetUrl = async (storageKey: string): Promise<string> => {
  const client = getB2Client();
  const { bucket } = getB2Config();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  return getSignedUrl(client, command, { expiresIn: PRESIGNED_GET_EXPIRES_SECONDS });
};

/**
 * B2オブジェクトを削除する（補償処理・差し替え時の旧ファイル削除で使用）。
 * 呼び出し側でtry/catchし、失敗した場合の扱い（ログ・Sentry送信等）を決めること。
 */
export const deleteB2Object = async (storageKey: string): Promise<void> => {
  const client = getB2Client();
  const { bucket } = getB2Config();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  await client.send(command);
};