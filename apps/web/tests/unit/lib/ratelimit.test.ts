import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import type { Ratelimit } from "@upstash/ratelimit";

const mockLimiter = (success: boolean, remaining = 10) =>
  ({
    limit: vi.fn().mockResolvedValue({
      success,
      limit: 30,
      remaining,
      reset: Date.now() + 60000,
    }),
  }) as unknown as Ratelimit;

describe("checkRateLimit", () => {
  it("制限内の場合はnullを返す", async () => {
    const limiter = mockLimiter(true);
    const result = await checkRateLimit(limiter, "user123");
    expect(result).toBeNull();
  });

  it("制限超過の場合は429レスポンスを返す", async () => {
    const limiter = mockLimiter(false, 0);
    const result = await checkRateLimit(limiter, "user123");

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it("429レスポンスにエラー情報が含まれる", async () => {
    const limiter = mockLimiter(false, 0);
    const result = await checkRateLimit(limiter, "user123");
    const body = await result?.json();

    expect(body.error).toBe("rate_limit_exceeded");
    expect(body.detail).toBeDefined();
  });

  it("429レスポンスにRateLimitヘッダーが含まれる", async () => {
    const limiter = mockLimiter(false, 0);
    const result = await checkRateLimit(limiter, "user123");

    expect(result?.headers.get("X-RateLimit-Limit")).toBe("30");
    expect(result?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result?.headers.get("Retry-After")).toBeDefined();
  });

  it("ユーザーIDがlimiterに渡される", async () => {
    const limiter = mockLimiter(true);
    await checkRateLimit(limiter, "specific-user-id");
    expect(limiter.limit).toHaveBeenCalledWith("specific-user-id");
  });
});