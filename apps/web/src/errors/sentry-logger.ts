import * as Sentry from "@sentry/nextjs";

export const logErrorToSentry = (
  error: Error,
  level: "global" | "page" | "component",
  extra?: Record<string, unknown>,
) => {
  console.error(`[${level.toUpperCase()}] Error caught:`, {
    error,
    ...extra,
  });

  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      extra: {
        ...extra,
        level,
      },
      tags: {
        service: "web",
        component: (extra?.component as string) ?? level,
        error_level: level,
        ...(extra?.route ? { route: extra.route as string } : {}),
        ...(extra?.user_id ? { user_id: extra.user_id as string } : {}),
      },
      contexts: {
        ...(extra?.correlation_id
          ? { correlation: { correlation_id: extra.correlation_id as string } }
          : {}),
      },
    });
  }
};
