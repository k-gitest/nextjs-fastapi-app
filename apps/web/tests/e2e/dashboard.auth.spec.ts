import { test, expect } from '@playwright/test';

test.describe("ダッシュボードページ (認証済み)", () => {
  test("ダッシュボードが表示されること", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "ダッシュボード", level: 1 })
    ).toBeVisible();
  });
});