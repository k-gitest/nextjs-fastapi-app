/**
 * StorageCleanupTask（Type A/Type B）の手動回収スクリプト。
 *
 * Type A: B2 PUT成功後にImage DB作成が失敗し、B2オブジェクトが孤立するケース
 * Type B: Image DB削除後にB2 DeleteObjectが失敗し、B2オブジェクトが残存するケース
 * 
 * Worker統合前からの暫定運用スクリプト。実行場所をapps/webとしているのは、
 * B2クライアント（lib/b2.ts）がweb専用実装であるため。
 *
 * --dry-run: pendingタスクを一覧表示するだけ。B2への破壊的操作は一切行わない。
 * --run    : pendingタスクを取得し、実際にdeleteB2Objectを再試行する。
 *
 * 取得条件は status="pending" のみ（nextRetryAtはWorker側のバックオフ制御用の
 * フィールドであり、この手動スクリプトでは条件に使わない）。
 *
 * 注意: lib/b2.tsはモジュールトップレベルでprocess.env.B2_BUCKET等を読んで固定する
 * 実装のため、静的importするとloadEnvConfig()実行前にモジュールが評価されてしまい、
 * 環境変数が空文字のまま固定される（実際にこの不具合が発生し、B2操作が
 * "No value provided for input HTTP label: Bucket" で失敗した）。
 * そのため、loadEnvConfig()実行後に動的importする。
 * lib/b2.ts自体の環境変数読み込み方式は、このスクリプトでは変更しない。
 *
 * 実行方法:
 *   npx tsx apps/web/scripts/storageCleanup.ts --dry-run
 *   npx tsx apps/web/scripts/storageCleanup.ts --run
 * 
 * 【運用ルール】
 * apps/workerにStorageCleanupTaskの自動回収Worker
 * （storageCleanupWorker.ts / storageCleanupWorkerService.ts）が実装されており、
 * Workerが自動回収の正規経路である。
 *
 * このスクリプトの --run は、原子的claim（FOR UPDATE SKIP LOCKED）を使用しない
 * 単純なfindMany+updateのため、Worker稼働中に実行すると同一タスクの二重処理が
 * 発生しうる（B2 DeleteObject自体は冪等だが、DB状態更新が競合する可能性がある）。
 *
 * 通常運用では --run を使用しない。緊急時に手動回収が必要な場合は、
 * 必ずWorkerを停止した状態（Renderサービスの一時停止、またはローカルWorkerプロセスの
 * 停止）で実行すること。
 *
 * --dry-run はpendingタスクの確認用途のため、Worker稼働中でも引き続き使用可能。
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@repo/db";

const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir);

const prisma = new PrismaClient();

const DEFAULT_BATCH_SIZE = 100;

const maskDatabaseUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "***(parse failed)***";
  }
};

const printEnvironmentInfo = (): void => {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const b2Bucket = process.env.B2_BUCKET ?? "";

  console.log("========================================");
  console.log(`DATABASE_URL : ${databaseUrl ? maskDatabaseUrl(databaseUrl) : "(未設定)"}`);
  console.log(`B2_BUCKET    : ${b2Bucket || "(未設定)"}`);
  console.log("========================================");
};

const formatTask = (task: {
  id: string;
  storageKey: string;
  reason: string;
  status: string;
  retryCount: number;
  lastError: string | null;
  createdAt: Date;
  lastAttemptAt: Date | null;
}): string => {
  return [
    `id           : ${task.id}`,
    `storageKey   : ${task.storageKey}`,
    `reason       : ${task.reason}`,
    `status       : ${task.status}`,
    `retryCount   : ${task.retryCount}`,
    `lastError    : ${task.lastError ?? "(none)"}`,
    `createdAt    : ${task.createdAt.toISOString()}`,
    `lastAttemptAt: ${task.lastAttemptAt?.toISOString() ?? "(none)"}`,
  ].join("\n");
};

async function runDryRun(): Promise<void> {
  console.log("Storage Cleanup Dry Run");
  printEnvironmentInfo();

  const tasks = await prisma.storageCleanupTask.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: DEFAULT_BATCH_SIZE,
  });

  console.log(`対象件数: ${tasks.length}`);
  console.log("（B2への削除リクエストは送信していません）");
  console.log("========================================");

  tasks.forEach((task, index) => {
    console.log(`\n[${index + 1}]`);
    console.log(formatTask(task));
  });

  console.log("\n========================================");
  console.log(`Dry Run完了: ${tasks.length} 件`);
}

async function runCleanup(
  deleteB2Object: (storageKey: string) => Promise<void>,
): Promise<void> {
  console.log("Storage Cleanup Run");
  printEnvironmentInfo();

  const tasks = await prisma.storageCleanupTask.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: DEFAULT_BATCH_SIZE,
  });

  console.log(`対象件数: ${tasks.length}`);
  console.log("========================================");

  let resolvedCount = 0;
  let failedCount = 0;

  for (const task of tasks) {
    try {
      await deleteB2Object(task.storageKey);
      await prisma.storageCleanupTask.update({
        where: { id: task.id },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
          lastAttemptAt: new Date(),
        },
      });
      resolvedCount++;
      console.log(`[resolved] ${task.storageKey}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.storageCleanupTask.update({
        where: { id: task.id },
        data: {
          retryCount: { increment: 1 },
          lastError: errorMessage,
          lastAttemptAt: new Date(),
        },
      });
      failedCount++;
      console.error(`[failed]   ${task.storageKey}: ${errorMessage}`);
    }
  }

  console.log("========================================");
  console.log(`完了: resolved=${resolvedCount}, failed=${failedCount}`);
  console.log("========================================");
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isRun = args.includes("--run");

  if (isDryRun === isRun) {
    console.error("必ず --dry-run または --run のいずれか一方を指定してください");
    process.exit(1);
  }

  if (isDryRun) {
    await runDryRun();
    return;
  }

  // lib/b2.tsはモジュールトップレベルでprocess.envを読むため、
  // loadEnvConfig()実行後に動的importする（詳細はファイル冒頭のコメント参照）
  const b2 = await import("../src/lib/b2");
  await runCleanup(b2.deleteB2Object);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });