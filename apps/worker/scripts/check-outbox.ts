/**
 * Outbox チェーン Smoke テストスクリプト
 *
 * 目的:
 *   staging/production の smoke テスト時に、
 *   分散チェーン全体の最終整合性を確認する。
 *
 *   確認対象:
 *   UI → Next.js → outbox_events → Worker → QStash → FastAPI → processed_events
 *
 * 使用方法:
 *   npx tsx scripts/check-outbox.ts
 *
 * 終了コード:
 *   0: 正常（全チェック通過）
 *   1: 異常（いずれかのチェック失敗）
 *
 * 環境変数:
 *   DATABASE_URL:             Neon PostgreSQL 接続文字列
 *   SMOKE_PREFIX:             smoke テストが生成した Todo を識別する prefix（デフォルト: "smoke-"）
 *                             payload.todo_title にこの prefix が含まれるイベントのみを確認対象にする。
 *                             todoService.ts の idempotency_key は randomUUID() のため
 *                             idempotency_key では絞り込めない。payload.todo_title を使う。
 *                             ワークフローから "smoke-${github.run_id}-" を渡すことで
 *                             並行実行時の衝突を防げる（改善候補1対応）。
 *   CHECK_WINDOW_MINUTES:     確認対象の時間幅（デフォルト: 5分）
 *   POLLING_INTERVAL_MS:      polling 間隔（デフォルト: 5000ms）
 *   POLLING_TIMEOUT_MS:       polling タイムアウト（デフォルト: 60000ms）
 *   STALE_PROCESSING_MS:      processing を異常とみなす経過時間（デフォルト: 60000ms）
 *                             transient delay（cold start・一時遅延）を許容するための閾値。
 */

import { PrismaClient } from "@repo/db";

const prisma = new PrismaClient();

// 設定（環境変数で上書き可能）
const SMOKE_PREFIX = process.env.SMOKE_PREFIX ?? "smoke-";
const CHECK_WINDOW_MINUTES = Number(process.env.CHECK_WINDOW_MINUTES ?? 5);
const POLLING_INTERVAL_MS = Number(process.env.POLLING_INTERVAL_MS ?? 5_000);
const POLLING_TIMEOUT_MS = Number(process.env.POLLING_TIMEOUT_MS ?? 60_000);
// processing を異常とみなす経過時間（transient delay を許容するための閾値）
// Worker polling: 1秒、processEvent timeout: 10秒 のため、
// 1分以上 processing にいるものは Worker hang / deadlock とみなす
const STALE_PROCESSING_MS = Number(process.env.STALE_PROCESSING_MS ?? 60_000);

// ログヘルパー
const log = {
  info: (msg: string) => console.log(`[INFO]  ${msg}`),
  warn: (msg: string) => console.warn(`[WARN]  ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  success: (msg: string) => console.log(`[OK]    ${msg}`),
};

/**
 * ① 必須チェック：outbox_events の状態確認
 *
 * 直近 CHECK_WINDOW_MINUTES 以内に作成された todo 系イベントのうち、
 * payload.todo_title に SMOKE_PREFIX を含むもの（今回の smoke test が生成したイベント）のみを対象とする。
 *
 * 絞り込み戦略:
 *   - event_type が "todo." で始まる → analytics/dlt 系イベントを除外
 *   - payload.todo_title が SMOKE_PREFIX で始まる → 他ユーザーや cron の操作を除外
 *     string_starts_with（前方一致）を使うことで部分一致による誤検知を防ぐ
 *
 * idempotency_key は randomUUID() のため絞り込みには使えない（todoService.ts 参照）。
 * payload のキーは todoService.ts の実装に基づき "todo_title" を使う。
 *
 * failed / pending / retrying が1件でも残っていれば即 fail。
 * processing は以下の2ケースで fail:
 *   - locked_at が null（Worker がロック取得前にクラッシュした整合性異常）
 *   - locked_at が STALE_PROCESSING_MS 以上経過（Worker hang / deadlock）
 * それ以外の processing は transient delay として許容（warn のみ）。
 */
async function checkOutboxEvents(): Promise<{
  sentKeys: string[];
  passed: boolean;
}> {
  log.info(
    `outbox_events チェック（直近 ${CHECK_WINDOW_MINUTES} 分以内・event_type="todo.*"・payload.todo_title prefix="${SMOKE_PREFIX}"）...`,
  );

  const windowStart = new Date(
    Date.now() - CHECK_WINDOW_MINUTES * 60 * 1000,
  );

  // 直近の todo 系イベントを全件取得（時系列順：CI失敗時のログ解析を容易にするため）
  // - event_type が "todo." で始まる → analytics/dlt 系イベントを除外
  // - payload.todo_title が SMOKE_PREFIX で始まる（前方一致）→ 今回の smoke test が生成したイベントのみを追う
  //   string_starts_with で部分一致を防ぎ、偶然 SMOKE_PREFIX を含む他ユーザーの操作を除外
  //   idempotency_key は randomUUID() のため絞り込みには使えない
  const events = await prisma.outbox_events.findMany({
    where: {
      created_at: { gte: windowStart },
      event_type: { startsWith: "todo." },
      payload: {
        path: ["todo_title"],
        // string_starts_with で前方一致にすることで、
        // 別ユーザーが偶然 SMOKE_PREFIX を含むタイトルを作っても衝突しない
        // （"foo-smoke-123-bar" のような部分一致を防ぐ）
        string_starts_with: SMOKE_PREFIX,
      },
    },
    select: {
      id: true,
      event_type: true,
      status: true,
      idempotency_key: true,
      retry_count: true,
      last_error: true,
      locked_at: true,
    },
    orderBy: {
      created_at: "asc",
    },
  });

  // イベント0件 = Playwright が smoke 操作を実行していない = smoke テスト自体が機能していない
  if (events.length === 0) {
    log.error(
      `直近 ${CHECK_WINDOW_MINUTES} 分以内に対象イベントが存在しません（event_type="todo.*", payload.todo_title contains "${SMOKE_PREFIX}"）。`,
    );
    log.error(
      "Playwright の smoke テストが Todo を作成したか確認してください。",
    );
    return { sentKeys: [], passed: false };
  }

  log.info(`対象イベント数: ${events.length} 件`);

  // ステータス別に分類
  const failed = events.filter((e) => e.status === "failed");
  const pending = events.filter((e) => e.status === "pending");
  const retrying = events.filter((e) => e.status === "retrying");
  const processing = events.filter((e) => e.status === "processing");
  const sent = events.filter((e) => e.status === "sent");

  log.info(`  sent:       ${sent.length} 件`);
  log.info(`  processing: ${processing.length} 件`);
  log.info(`  retrying:   ${retrying.length} 件`);
  log.info(`  pending:    ${pending.length} 件`);
  log.info(`  failed:     ${failed.length} 件`);

  let passed = true;

  // processing の異常判定（2ケース）:
  //
  // ケース1: locked_at = null かつ status = processing
  //   Worker がロック取得前にクラッシュした整合性異常。
  //   正常な processing では必ず locked_at が設定される（worker.ts 参照）。
  //
  // ケース2: locked_at が STALE_PROCESSING_MS 以上経過
  //   Worker hang / QStash timeout / Prisma deadlock 等の異常。
  //   Worker polling: 1秒、processEvent timeout: 10秒 のため、
  //   STALE_PROCESSING_MS（デフォルト60秒）以上は異常とみなす。
  //
  // それ以外（locked_at あり・時間内）は transient delay として許容（warn のみ）。
  const invalidProcessing = processing.filter((e) => e.locked_at === null);
  const staleProcessing = processing.filter(
    (e) =>
      e.locked_at !== null &&
      Date.now() - e.locked_at.getTime() > STALE_PROCESSING_MS,
  );
  const transientProcessing = processing.filter(
    (e) =>
      e.locked_at !== null &&
      Date.now() - e.locked_at.getTime() <= STALE_PROCESSING_MS,
  );

  if (invalidProcessing.length > 0) {
    log.error(
      `locked_at=null のまま processing になっているイベントが ${invalidProcessing.length} 件存在します（整合性異常）:`,
    );
    for (const e of invalidProcessing) {
      log.error(`  id=${e.id} type=${e.event_type}`);
    }
    passed = false;
  }

  if (staleProcessing.length > 0) {
    log.error(
      `${STALE_PROCESSING_MS / 1000} 秒以上 processing のまま残っているイベントが ${staleProcessing.length} 件存在します（Worker 異常の可能性）:`,
    );
    for (const e of staleProcessing) {
      log.error(
        `  id=${e.id} type=${e.event_type} locked_at=${e.locked_at?.toISOString() ?? "null"}`,
      );
    }
    passed = false;
  }

  if (transientProcessing.length > 0) {
    log.warn(
      `processing 中のイベントが ${transientProcessing.length} 件あります（${STALE_PROCESSING_MS / 1000} 秒未満のため transient delay として許容）`,
    );
  }

  if (failed.length > 0) {
    log.error(`failed イベントが ${failed.length} 件存在します:`);
    for (const e of failed) {
      log.error(
        `  id=${e.id} type=${e.event_type} retry=${e.retry_count} error=${e.last_error?.slice(0, 200)}`,
      );
    }
    passed = false;
  }

  if (pending.length > 0) {
    log.error(
      `pending のまま残っているイベントが ${pending.length} 件存在します:`,
    );
    for (const e of pending) {
      log.error(`  id=${e.id} type=${e.event_type}`);
    }
    passed = false;
  }

  if (retrying.length > 0) {
    log.error(
      `retrying のまま残っているイベントが ${retrying.length} 件存在します:`,
    );
    for (const e of retrying) {
      log.error(
        `  id=${e.id} type=${e.event_type} retry=${e.retry_count} error=${e.last_error?.slice(0, 200)}`,
      );
    }
    passed = false;
  }

  if (passed) {
    log.success(`outbox_events チェック通過（全 ${sent.length} 件 sent）`);
  }

  return {
    sentKeys: sent.map((e) => e.idempotency_key),
    passed,
  };
}

/**
 * ② polling チェック：processed_events の確認
 *
 * sent になった outbox_events の idempotency_key が
 * processed_events に存在するかを polling で確認する。
 *
 * FastAPI は BackgroundTasks で非同期処理するため、
 * sent 直後は未記録の場合がある。
 * POLLING_TIMEOUT_MS 以内に現れなければ fail。
 *
 * handler_name には依存せず idempotency_key のみで突き合わせるため、
 * 新しい webhook handler を追加してもこのスクリプトの修正は不要。
 */
async function checkProcessedEvents(sentKeys: string[]): Promise<boolean> {
  if (sentKeys.length === 0) {
    log.warn(
      "確認対象の sent イベントがないため processed_events チェックをスキップします。",
    );
    return true;
  }

  log.info(
    `processed_events polling チェック（最大 ${POLLING_TIMEOUT_MS / 1000} 秒・${POLLING_INTERVAL_MS / 1000} 秒間隔）...`,
  );
  log.info(`確認対象: ${sentKeys.length} 件`);

  const startTime = Date.now();
  let unprocessedKeys = [...sentKeys];

  while (unprocessedKeys.length > 0) {
    // 現在までに processed_events に記録されたキーを取得
    const processed = await prisma.processed_events.findMany({
      where: {
        idempotency_key: { in: unprocessedKeys },
      },
      select: {
        idempotency_key: true,
        handler_name: true,
      },
    });

    const processedKeySet = new Set(processed.map((p) => p.idempotency_key));
    unprocessedKeys = unprocessedKeys.filter((k) => !processedKeySet.has(k));

    const processedCount = sentKeys.length - unprocessedKeys.length;
    log.info(
      `  確認済み: ${processedCount}/${sentKeys.length} 件（残り ${unprocessedKeys.length} 件）`,
    );

    if (unprocessedKeys.length === 0) {
      log.success(
        `processed_events チェック通過（全 ${sentKeys.length} 件確認済み）`,
      );
      return true;
    }

    // タイムアウト確認
    const elapsed = Date.now() - startTime;
    if (elapsed >= POLLING_TIMEOUT_MS) {
      log.error(
        `polling タイムアウト（${POLLING_TIMEOUT_MS / 1000} 秒以内に processed_events が確認できませんでした）`,
      );
      log.error(`未確認の idempotency_key:`);
      for (const key of unprocessedKeys) {
        log.error(`  ${key}`);
      }
      return false;
    }

    // 次の polling まで待機
    await new Promise<void>((r) => setTimeout(r, POLLING_INTERVAL_MS));
  }

  return true;
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  log.info("=== Outbox チェーン Smoke テスト開始 ===");
  log.info(`確認ウィンドウ: 直近 ${CHECK_WINDOW_MINUTES} 分`);
  log.info(`Polling タイムアウト: ${POLLING_TIMEOUT_MS / 1000} 秒`);
  console.log("");

  try {
    // ① outbox_events チェック
    const { sentKeys, passed: outboxPassed } = await checkOutboxEvents();
    console.log("");

    if (!outboxPassed) {
      log.error("=== Smoke テスト失敗：outbox_events に異常があります ===");
      process.exitCode = 1;
      return;
    }

    // ② processed_events polling チェック
    const processedPassed = await checkProcessedEvents(sentKeys);
    console.log("");

    if (!processedPassed) {
      log.error(
        "=== Smoke テスト失敗：FastAPI への到達が確認できませんでした ===",
      );
      process.exitCode = 1;
      return;
    }

    log.success("=== Outbox チェーン Smoke テスト完了：全チェック通過 ===");
  } catch (err) {
    log.error(
      `予期しないエラー: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();