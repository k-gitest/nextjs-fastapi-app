import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.resolve(__dirname, "../../../playwright-results/.auth/user.json");

setup("authenticate", async ({ page }) => {
  // Next.jsの/loginページではなくAuth0のログインエンドポイントへ直接アクセス
  await page.goto("/auth/login");

  // Auth0のUniversal Loginページにリダイレクトされるのを待つ
  await page.waitForURL(/auth0\.com/);

  // Auth0のフォームに入力
  // ※ Auth0のUIはテナントやテーマ設定によってセレクタが変わる場合がある
  await page.getByLabel("Email address").fill(process.env.E2E_TEST_EMAIL!);
  //await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#password").fill(process.env.E2E_TEST_PASSWORD!);
  await page.locator('button[data-action-button-primary="true"]').click();

  // アプリにリダイレクトされるのを待つ
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await expect(page).toHaveURL(/dashboard/);

  // 認証状態を保存
  await page.context().storageState({ path: authFile });
});
