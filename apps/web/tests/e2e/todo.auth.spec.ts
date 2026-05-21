import { test, expect } from "@playwright/test";

// ワークフローから渡される SMOKE_PREFIX（デフォルト: "smoke-"）
// "smoke-${github.run_id}-" を受け取ることで並行実行時の衝突を防ぐ
// check-outbox.ts は payload.todo_title にこの prefix が含まれるイベントのみを確認対象にする
const SMOKE_PREFIX = process.env.SMOKE_PREFIX ?? "smoke-";

test.describe("Todoページ (認証済み)", () => {
  test.beforeEach(async ({ page }) => {
    // Todoページへ移動
    await page.goto("/todo");

    // AsyncBoundary (Suspense) が解決し、ページが表示されるまで待機
    await expect(
      page.getByRole("heading", { name: "TODO" })
    ).toBeVisible();
  });

  // @smoke: UI・CRUD の基本動作確認 + Outbox チェーンの起点となる操作
  // smoke テスト後に check-outbox.ts がこの操作で生成された outbox_events を確認する
  test("Todoの新規作成フロー @smoke", async ({ page }) => {
    const todoTitle = `${SMOKE_PREFIX}test-todo-${Date.now()}`;

    // Todo作成フォームを開く
    await page.getByRole("button", { name: /新規作成|追加|Add/i }).click();

    // タイトルを入力
    await page.getByRole("textbox", { name: /タイトル|title/i }).fill(todoTitle);

    // 送信
    await page.getByRole("button", { name: /作成|保存|Save|Create/i }).click();

    // 作成したTodoが一覧に表示されることを確認
    await expect(page.getByText(todoTitle)).toBeVisible();
  });

  test("Todoの編集フロー @smoke", async ({ page }) => {
    const originalTitle = `${SMOKE_PREFIX}edit-${Date.now()}`;
    const updatedTitle = `${SMOKE_PREFIX}edited-${Date.now()}`;

    // 編集対象のTodoを作成
    await page.getByRole("button", { name: /新規作成|追加|Add/i }).click();
    await page.getByRole("textbox", { name: /タイトル|title/i }).fill(originalTitle);
    await page.getByRole("button", { name: /作成|保存|Save|Create/i }).click();
    await expect(page.getByText(originalTitle)).toBeVisible();

    // 編集ボタンをクリック
    await page.getByText(originalTitle).hover();
    await page.getByRole("button", { name: /編集|Edit/i }).first().click();

    // タイトルを更新
    const titleInput = page.getByRole("textbox", { name: /タイトル|title/i });
    await titleInput.clear();
    await titleInput.fill(updatedTitle);
    await page.getByRole("button", { name: /更新|保存|Save|Update/i }).click();

    // 更新されたTodoが表示されることを確認
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByText(originalTitle)).not.toBeVisible();
  });

  test("Todoの削除フロー @smoke", async ({ page }) => {
    const todoTitle = `${SMOKE_PREFIX}delete-${Date.now()}`;

    // 削除対象のTodoを作成
    await page.getByRole("button", { name: /新規作成|追加|Add/i }).click();
    await page.getByRole("textbox", { name: /タイトル|title/i }).fill(todoTitle);
    await page.getByRole("button", { name: /作成|保存|Save|Create/i }).click();
    await expect(page.getByText(todoTitle)).toBeVisible();

    // 削除ボタンをクリック
    await page.getByText(todoTitle).hover();
    await page.getByRole("button", { name: /削除|Delete/i }).first().click();

    // 確認ダイアログがある場合は承認
    const confirmButton = page.getByRole("button", { name: /確認|OK|はい|Yes/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // 削除されたTodoが表示されないことを確認
    await expect(page.getByText(todoTitle)).not.toBeVisible();
  });
});