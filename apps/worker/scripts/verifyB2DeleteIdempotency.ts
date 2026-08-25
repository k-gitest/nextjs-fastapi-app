/**
 * 【検証専用・使い捨てスクリプト】
 *
 * Backblaze B2（S3互換API）に対して、
 *   1. 実在するオブジェクトへのDeleteObject（1回目・成功するはず）
 *   2. 同じKeyへの2回目のDeleteObject（既に存在しない → 挙動を確認したい本題）
 *   3. 最初から存在しないランダムKeyへのDeleteObject（同上、念のため2パターン確認）
 *
 * を実際に実行し、レスポンス・エラーの詳細（httpStatusCode / name / Code）を
 * そのまま出力する。Image削除のOutbox化（image.storage_delete_requested）で
 * B2 DeleteObjectをPermanentError/TransientErrorのどちらに倒すかは、
 * ここで得られた実測結果を元に確定する。
 *
 * 実行方法（apps/worker ディレクトリから）:
 *   dotenv -e apps/worker/.env -- npx tsx scripts/verifyB2DeleteIdempotency.ts
 *
 * 検証が終わったらこのファイルは削除してよい（正規のStorageCleanupTaskとは
 * 無関係の一時ファイルのため）。
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  B2_ENDPOINT,
  B2_REGION,
  B2_BUCKET,
  B2_KEY_ID,
  B2_APPLICATION_KEY,
} from "../src/config";

const b2Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

// 検証専用の使い捨てKey。本番のstorageKey命名規則（uploads/{uuid}.{ext}）に
// 影響しないよう、専用prefixを付けて衝突を避ける。
const TEST_KEY = `verify-delete-idempotency/${crypto.randomUUID()}.txt`;
const NONEXISTENT_KEY = `verify-delete-idempotency/${crypto.randomUUID()}-never-existed.txt`;

/**
 * エラーオブジェクトから分かる範囲の情報をすべて出力するヘルパー。
 * AWS SDK v3のエラー形状（$metadata.httpStatusCode / name / Code等）を
 * 決め打ちせず、まず生の中身を見るために使う。
 */
function dumpError(label: string, error: unknown): void {
  console.log(`\n--- ${label}: エラーが発生 ---`);
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    console.log("name:", err.name);
    console.log("message:", err.message);
    console.log("$metadata:", JSON.stringify(err.$metadata, null, 2));
    console.log("Code (S3互換APIのエラーコード):", err.Code ?? "(なし)");
    console.log("--- フルオブジェクト（JSON化できる範囲） ---");
    try {
      console.log(JSON.stringify(error, null, 2));
    } catch {
      console.log("(JSON化不可。console.dirで出力)");
      console.dir(error, { depth: 5 });
    }
  } else {
    console.log("非オブジェクトのエラー:", error);
  }
}

function dumpSuccess(label: string, result: unknown): void {
  console.log(`\n--- ${label}: 成功（例外なし） ---`);
  console.log("$metadata:", JSON.stringify((result as { $metadata?: unknown })?.$metadata, null, 2));
}

async function main() {
  console.log("=== B2 DeleteObject 冪等性検証 開始 ===");
  console.log("Bucket:", B2_BUCKET);
  console.log("Endpoint:", B2_ENDPOINT);
  console.log("Test Key:", TEST_KEY);
  console.log("Nonexistent Key:", NONEXISTENT_KEY);

  // Step 1: テスト用オブジェクトを作成（削除対象を実在させるため）
  console.log("\n[Step 1] テスト用オブジェクトをPUT...");
  try {
    const putResult = await b2Client.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: TEST_KEY,
        Body: "verify-delete-idempotency test content",
        ContentType: "text/plain",
      }),
    );
    dumpSuccess("PUT", putResult);
  } catch (error) {
    dumpError("PUT", error);
    console.log("\nPUTに失敗したため、これ以降の検証を中断します。");
    process.exit(1);
  }

  // Step 2: 実在するオブジェクトへの1回目のDELETE（成功するはず）
  console.log("\n[Step 2] 実在するKeyへの1回目のDELETE...");
  try {
    const result = await b2Client.send(
      new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: TEST_KEY }),
    );
    dumpSuccess("DELETE (1回目・実在Key)", result);
  } catch (error) {
    dumpError("DELETE (1回目・実在Key)", error);
  }

  // Step 3: 【本題】同じKeyへの2回目のDELETE（既に存在しないはず）
  console.log("\n[Step 3] 【本題】同じKeyへの2回目のDELETE（既に存在しないはず）...");
  try {
    const result = await b2Client.send(
      new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: TEST_KEY }),
    );
    dumpSuccess("DELETE (2回目・削除済みKey)", result);
  } catch (error) {
    dumpError("DELETE (2回目・削除済みKey)", error);
  }

  // Step 4: 【本題】最初から一度も存在しないKeyへのDELETE
  console.log("\n[Step 4] 【本題】最初から存在しないKeyへのDELETE...");
  try {
    const result = await b2Client.send(
      new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: NONEXISTENT_KEY }),
    );
    dumpSuccess("DELETE (存在しないKey)", result);
  } catch (error) {
    dumpError("DELETE (存在しないKey)", error);
  }

  console.log("\n=== 検証終了 ===");
  console.log(
    "上記のStep 3・Step 4の結果（成功 or エラーの場合はhttpStatusCode）を貼ってください。",
  );
}

main().catch((error) => {
  console.error("スクリプト全体で予期しないエラー:", error);
  process.exit(1);
});