import { test, expect } from "@playwright/test";

test.describe("ダッシュボードページ (未認証)", () => {
  test("未認証で /dashboard にアクセスすると /auth/login へリダイレクトされること", async ({
    page,
  }) => {
    const [authLoginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/auth/login") && response.status() === 307
      ),
      page.goto("/dashboard"),
    ]);

    expect(authLoginResponse.status()).toBe(307);
  });
});