import { after } from "next/server";

/**
 * Next.jsのafter()を使用して、レスポンス返却後に非同期タスクを実行する
 * @param tasks 実行したいPromiseの配列。戻り値は何でも良いためunknownとしています
 */
export function runAfterResponse(tasks: Promise<unknown>[]): void {
  after(async () => {
    const results = await Promise.allSettled(tasks);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        // 詳細なエラーログ。必要に応じてSentry等へ送信
        console.error(`[Background Task Failed] index: ${index}`, {
          reason: result.reason instanceof Error ? result.reason.message : result.reason,
        });
      }
    });
  });
}