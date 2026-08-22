import * as Sentry from "@sentry/nextjs";

/**
 * Route Handler / Service層からのサーバーサイド運用エラーをSentryへ送る。
 *
 * errors/sentry-logger.ts はReact Error Boundary専用（componentStack前提の設計）のため、
 * サーバーサイドの運用ログはこちらに分離する。
 *
 * correlation_idはUUIDでcardinalityが高いため、Sentry tagsではなく
 * Sentry Contexts（"correlation"）に格納する。
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
        scope.setContext("correlation", { correlation_id: options.correlationId });
      }

      if (options.context) {
        scope.setContext(options.component, options.context);
      }

      Sentry.captureException(error);
    });
  }
};