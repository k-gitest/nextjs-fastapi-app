import * as Sentry from "@sentry/nextjs";

/**
 * Route Handler / Service層からのサーバーサイド運用エラーをSentryへ送る。
 *
 * errors/sentry-logger.ts はReact Error Boundary専用（componentStack前提の設計）のため、
 * サーバーサイドの運用ログはこちらに分離する。
 *
 * Worker（apps/worker/src/monitor.ts等）のSentry.withScope運用に合わせ、
 * correlation_id は tag、詳細情報は context に入れる方針で統一する。
 * （CLAUDE.mdの「correlation_idはcontextへ」という記述より、
 *   Worker実装ですでに採用されているtag運用を優先する）
 *
 * contextは常に options.component をキー名として setContext する。
 * 呼び出し側でcontext名を自由に付けさせない（命名の揺れを防ぐため）。
 */
export const logServiceError = (
  error: Error,
  options: {
    component: string;
    correlationId?: string;
    context?: Record<string, unknown>;
  },
): void => {
  console.error(`[SERVICE] ${options.component}:`, {
    error,
    correlationId: options.correlationId,
    ...options.context,
  });

  if (process.env.NODE_ENV === "production") {
    Sentry.withScope((scope) => {
      scope.setTag("service", "web");
      scope.setTag("component", options.component);
      scope.setLevel("error");

      if (options.correlationId) {
        scope.setTag("correlation_id", options.correlationId);
      }

      if (options.context) {
        scope.setContext(options.component, options.context);
      }

      Sentry.captureException(error);
    });
  }
};