import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Todo CRUD操作用レート制限
 * 30回/分 per ユーザー
 */
export const todoRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:todo",
  analytics: true,
});

/**
 * セマンティック検索用レート制限
 * 10回/分 per ユーザー（Gemini API呼び出しコスト考慮）
 */
export const searchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:search",
  analytics: true,
});