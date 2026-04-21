import { test, expect } from "@playwright/test";

test.describe("トップページ (Home)", () => {
  
  // このテストファイルでは認証状態（クッキー）をリセットして実行する
  // これにより、ダッシュボードのセッションが残っていてもゲストとしてテストできる
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // トップページへ移動
    await page.goto("/");
  });

  test("基本的な要素が正しく表示されていること", async ({ page }) => {
    // 1. Next.js ロゴの確認
    const nextLogo = page.getByAltText("Next.js logo");
    await expect(nextLogo).toBeVisible();

    // 2. メインの見出し「トップページ」を確認
    // getByRole を使うのがベストプラクティスです
    await expect(page.getByRole("heading", { name: "トップページ" })).toBeVisible();

    // 3. ボタン/リンクの確認
    const deployLink = page.getByRole("link", { name: "Deploy Now" });
    await expect(deployLink).toBeVisible();
    await expect(deployLink).toHaveAttribute("href", /vercel\.com\/new/);

    const docsLink = page.getByRole("link", { name: "Documentation" });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", /nextjs\.org\/docs/);
  });

  test("レスポンシブ：モバイルでもボタンが適切に配置されているか", async ({ page }) => {
    // ビューポートを小さくしてテスト（設定済みデバイス以外で確認したい場合）
    await page.setViewportSize({ width: 375, height: 667 });
    
    const deployLink = page.getByRole("link", { name: "Deploy Now" });
    const docsLink = page.getByRole("link", { name: "Documentation" });

    // モバイルでは w-full (横幅いっぱい) になるクラスがついていることを確認
    await expect(deployLink).toHaveClass(/w-full/);
    await expect(docsLink).toHaveClass(/w-full/);
  });
});