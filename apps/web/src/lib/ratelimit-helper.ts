/**
 * レート制限ヘルパー
 *
 * Route Handler内でratelimitチェックを行う共通関数
 * requireAuth()の後に呼び出す
 *
 * 使用例:
 *   const { user, response } = await requireAuth();
 *   if (!user) return response;
 *
 *   const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
 *   if (rateLimitResponse) return rateLimitResponse;
 */
import { NextResponse } from "next/server";
import type { Ratelimit } from "@upstash/ratelimit";

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<NextResponse | null> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        detail: "リクエストが多すぎます。しばらく時間をおいてから再度お試しください。",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }

  return null;
}