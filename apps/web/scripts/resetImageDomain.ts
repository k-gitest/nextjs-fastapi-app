/**
 * dev/staging限定のImageドメインリセットスクリプト。
 *
 * 対象:
 *   - Image全件削除（TodoImageはonDelete: CascadeによりPrismaが自動削除）
 *   - B2 uploads/配下の全オブジェクトをDeleteObjectCommandでHidden化
 *     （VersionId指定の物理削除はしない。runbook.md「Hidden File の確認方法」の
 *      方針＝物理削除はLifecycle Ruleに委譲、に従う）
 *
 * 安全装置:
 *   - --env=dev|staging を必須化（productionは選択肢として存在しない）
 *   - B2_BUCKET名は EXPECTED_BUCKETS との完全一致のみ許可する（allowlist方式）。
 *     部分一致（includes）は将来のバケット名追加時に誤って一致してしまう
 *     可能性があるため採用しない。
 *   - 削除対象件数を表示したうえで、"RESET {env}" という文字列の入力を要求する
 *   - B2削除が1件でも失敗した場合、DBが空・B2非Hidden一覧が空であっても
 *     成功扱いにしない（失敗した削除がHidden化されないまま残っている可能性があるため）
 *
 * 実行方法:
 *   npx tsx apps/web/scripts/resetImageDomain.ts --env=dev
 * 
 *   npx tsx apps/web/scripts/resetImageDomain.ts --env=staging --env-file=apps/web/.env.staging
 *
 *   apps/webにはtsxが入っていないため、事前に devDependencies へ追加すること
 *   （apps/worker/package.jsonと同一バージョン "^4.0.0" に揃える）。
 */
import path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadEnvConfig } from "@next/env";
import dotenv from "dotenv";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@repo/db";

// --env-file が指定された場合はそちらを優先する（staging等、apps/web/.envとは
// 異なる接続先を明示的に指定する場合に使う）。
// 指定がなければNext.jsと同じロジックでapps/web/.envを読み込む。
const envFileArg = process.argv
  .find((a) => a.startsWith("--env-file="))
  ?.split("=")[1];

if (envFileArg) {
  dotenv.config({ path: path.resolve(process.cwd(), envFileArg), override: true });
} else {
  const projectDir = path.resolve(__dirname, "..");
  loadEnvConfig(projectDir);
}

const prisma = new PrismaClient();

// allowlist方式。部分一致(includes)は将来のバケット名追加時に誤検知しうるため使わない。
const EXPECTED_BUCKETS = {
  dev: "next-fast-assets-dev",
  staging: "nextjs-fastapi-app-assets-staging",
} as const;

type TargetEnv = keyof typeof EXPECTED_BUCKETS;
const ALLOWED_ENVS = Object.keys(EXPECTED_BUCKETS) as TargetEnv[];

const UPLOADS_PREFIX = "uploads/";

const maskDatabaseUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "***(parse failed)***";
  }
};

const b2Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT ?? "",
  region: process.env.B2_REGION ?? "us-west-004",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID ?? "",
    secretAccessKey: process.env.B2_APPLICATION_KEY ?? "",
  },
  forcePathStyle: true,
});

const B2_BUCKET = process.env.B2_BUCKET ?? "";

const listUploadKeys = async (): Promise<string[]> => {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await b2Client.send(
      new ListObjectsV2Command({
        Bucket: B2_BUCKET,
        Prefix: UPLOADS_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return keys;
};

async function main() {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith("--env="))?.split("=")[1];

  if (!envArg || !ALLOWED_ENVS.includes(envArg as TargetEnv)) {
    console.error(
      "必ず --env=dev または --env=staging を指定してください（productionは選択不可）",
    );
    process.exit(1);
  }
  const targetEnv = envArg as TargetEnv;

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    console.error("DATABASE_URL が読み込めませんでした（apps/web/.env を確認してください）");
    process.exit(1);
  }
  if (!B2_BUCKET) {
    console.error("B2_BUCKET が読み込めませんでした（apps/web/.env を確認してください）");
    process.exit(1);
  }

  // allowlist完全一致チェック。--envと実際の接続先バケットが一致しない限り中断する。
  if (B2_BUCKET !== EXPECTED_BUCKETS[targetEnv]) {
    console.error(
      `B2_BUCKET="${B2_BUCKET}" は --env=${targetEnv} の許可されたバケット` +
      `("${EXPECTED_BUCKETS[targetEnv]}")と一致しません。中断します。`,
    );
    process.exit(1);
  }

  console.log("========================================");
  console.log(`対象環境        : ${targetEnv}`);
  console.log(`DATABASE_URL    : ${maskDatabaseUrl(databaseUrl)}`);
  console.log(`B2_BUCKET       : ${B2_BUCKET}`);
  console.log("========================================");

  const imageCount = await prisma.image.count();
  const todoImageCount = await prisma.todoImage.count();
  const uploadKeys = await listUploadKeys();

  console.log(`Image             : ${imageCount} 件`);
  console.log(`TodoImage         : ${todoImageCount} 件（Cascadeで削除される）`);
  console.log(`B2 uploads/ object: ${uploadKeys.length} 件`);
  console.log("========================================");

  if (imageCount === 0 && uploadKeys.length === 0) {
    console.log("削除対象がありません。終了します。");
    return;
  }

  const rl = readline.createInterface({ input, output });
  const confirmPhrase = `RESET ${targetEnv}`;
  const answer = await rl.question(
    `この操作は取り消せません。続行するには "${confirmPhrase}" と入力してください: `,
  );
  rl.close();

  if (answer !== confirmPhrase) {
    console.log("確認文字列が一致しませんでした。中断します。");
    process.exit(1);
  }

  // Image全件削除。TodoImageの削除はonDelete: Cascadeに委譲する（明示delete禁止。CLAUDE.md準拠）
  const deleteResult = await prisma.image.deleteMany({});
  console.log(`Image ${deleteResult.count} 件削除しました`);

  // B2 uploads/配下をDeleteObjectCommandでHidden化する。
  let deletedCount = 0;
  let failedCount = 0;
  for (const key of uploadKeys) {
    try {
      await b2Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key }));
      deletedCount++;
    } catch (error) {
      failedCount++;
      console.error(`削除失敗: ${key}`, error);
    }
  }
  console.log(`B2 uploads/: ${deletedCount} 件Hidden化, ${failedCount} 件失敗`);

  const remainingImages = await prisma.image.count();
  const remainingKeys = await listUploadKeys();

  console.log("========================================");
  console.log("リセット後の状態:");
  console.log(`Image                     : ${remainingImages}`);
  console.log(`B2 uploads/（非Hidden一覧）: ${remainingKeys.length}`);
  console.log(`B2削除失敗件数             : ${failedCount}`);
  console.log("========================================");

  // failedCountが0でなければ、非Hidden一覧が空に見えても成功扱いにしない。
  // DeleteObjectCommand失敗＝そのオブジェクトはHidden化されておらず、
  // 通常のListObjects結果には出ない別の理由（例: 権限エラーで一覧取得自体は成功する等）
  // で見かけ上「空」になるケースを成功と誤認するのを防ぐ。
  if (remainingImages !== 0 || remainingKeys.length !== 0 || failedCount !== 0) {
    console.error("警告: リセットが完全に完了していない可能性があります。手動確認してください。");
    process.exit(1);
  }

  console.log("Imageドメインリセット完了");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });