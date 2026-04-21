import { test, expect } from '@playwright/test';

test.describe('ダッシュボードページ', () => {
  
  test('ログイン状態でユーザー情報が正しく表示されること', async ({ page }) => {
    // 1. ダッシュボードへ移動
    // ※ 認証が必要な場合、本来はここでログイン処理を挟むか、storageState を使用します
    await page.goto('/dashboard'); 

    // 2. タイトルの確認
    await expect(page.getByRole('heading', { name: 'ダッシュボード', level: 1 })).toBeVisible();

    // 3. セッション情報（メールアドレスなど）が表示されているか確認
    // セッションがある前提のテスト
    const userEmail = page.locator('p');
    await expect(userEmail).toContainText('Logged in as');

    // 4. ユーザープロファイルの JSON (preタグ) が存在するか確認
    const profileJson = page.locator('pre');
    await expect(profileJson).not.toBeEmpty();

    // 5. ログアウトリンクが存在し、正しい href を持っているか
    await expect(page.getByTestId('dashboard-logout')).toHaveAttribute('href', '/auth/logout');
  });

  test('未ログイン時はセッション情報が表示されないこと', async ({ browser }) => {
    // プロジェクトの storageState を使わず、空のコンテキストを作成
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/dashboard');

    // 未ログインなので、情報は表示されない（あるいはログイン画面に飛ばされる）はず
    await expect(page.locator('text=Logged in as')).not.toBeVisible();
    
    await context.close();
  });
});