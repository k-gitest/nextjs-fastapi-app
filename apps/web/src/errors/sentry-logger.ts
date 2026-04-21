import * as Sentry from "@sentry/nextjs";

export const logErrorToSentry = (
  error: Error,
  level: 'global' | 'page' | 'component',
  extra?: Record<string, unknown>
) => {
  console.error(`[${level.toUpperCase()}] Error caught:`, {
    error,
    ...extra
  });

  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      extra: {
        ...extra,
        level,
      },
      tags: {
        error_level: level,
      }
    });
  }
};