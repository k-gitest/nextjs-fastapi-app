import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// B2はS3互換APIを提供しているため、標準のS3 SDKで扱う。
// エンドポイント・リージョンはBackblazeアカウント作成時に確定する値。
// 未確定の間は .env に空文字を入れておき、実際に呼び出すまでは影響しない。
const B2_ENDPOINT = process.env.B2_ENDPOINT ?? "";
const B2_REGION = process.env.B2_REGION ?? "us-west-000";
const B2_BUCKET = process.env.B2_BUCKET ?? "";
const B2_KEY_ID = process.env.B2_KEY_ID ?? "";
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY ?? "";

export const b2Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
  // B2のS3互換APIはpath-style URLを要求する
  forcePathStyle: true,
});

const PRESIGNED_PUT_EXPIRES_SECONDS = 5 * 60; // 5分
const PRESIGNED_GET_EXPIRES_SECONDS = 5 * 60; // 5分

/**
 * アップロード用のオブジェクトキーをサーバー側で生成する。
 * クライアントに生成させない（パストラバーサル・namespace衝突対策）。
 *
 * 例: uploads/2026/07/04/{userId}/{uuid}.jpg
 */
export const buildStorageKey = (userId: string, uuid: string, extension: string): string => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  return `uploads/${yyyy}/${mm}/${dd}/${userId}/${uuid}.${extension}`;
};

/**
 * アップロード用のPresigned PUT URLを発行する。
 * Content-Typeを署名に含めることで、指定したMIMEタイプ以外でのPUTを拒否させる。
 */
export const createPresignedPutUrl = async (storageKey: string, mimeType: string): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: storageKey,
    ContentType: mimeType,
  });

  return getSignedUrl(b2Client, command, { expiresIn: PRESIGNED_PUT_EXPIRES_SECONDS });
};

/**
 * 表示用のPresigned GET URLを発行する（バケットがallPrivateのため）。
 * Route Handlerでこれを取得し、302 Redirectでブラウザへ渡す想定。
 */
export const createPresignedGetUrl = async (storageKey: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: B2_BUCKET,
    Key: storageKey,
  });

  return getSignedUrl(b2Client, command, { expiresIn: PRESIGNED_GET_EXPIRES_SECONDS });
};

/**
 * B2オブジェクトを削除する（補償処理・差し替え時の旧ファイル削除で使用）。
 * 呼び出し側でtry/catchし、失敗した場合の扱い（ログ・Sentry送信等）を決めること。
 */
export const deleteB2Object = async (storageKey: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: B2_BUCKET,
    Key: storageKey,
  });

  await b2Client.send(command);
};