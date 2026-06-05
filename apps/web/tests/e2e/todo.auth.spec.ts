import { test, expect } from "@playwright/test";

// ワークフローから渡される SMOKE_PREFIX（デフォルト: "smoke-"）
// "smoke-${github.run_id}-" を受け取ることで並行実行時の衝突を防ぐ
// check-outbox.ts は payload.todo_title にこの prefix が含まれるイベントのみを確認対象にする
const SMOKE_PREFIX = process.env.SMOKE_PREFIX ?? "smoke-";

test.describe("Todoページ (認証済み)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/todo", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "TODO", exact: true })
    ).toBeVisible();
  });
  
  test.afterEach(async ({ page }) => {
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  // @smoke: UI・CRUD の基本動作確認 + Outbox チェーンの起点となる操作
  // smoke テスト後に check-outbox.ts がこの操作で生成された outbox_events を確認する
  test("Todoの新規作成フロー @smoke", async ({ page }) => {
    const todoTitle = `${SMOKE_PREFIX}test-todo-${Date.now()}`;

    // Todo作成フォームを開く
    await page.getByRole("button", { name: /新規タスク追加/i }).click();

    // タイトルを入力
    await page.getByRole("textbox", { name: /タイトル|title/i }).fill(todoTitle);

    // 送信
    await page.getByRole("button", { name: /タスクを作成|作成|保存|Save|Create/i }).click();

    // 作成したTodoが一覧に表示されることを確認
    await expect(page.getByText(todoTitle)).toBeVisible();
  });

  test("Todoの編集フロー @smoke", async ({ page }) => {
    const originalTitle = `${SMOKE_PREFIX}edit-${Date.now()}`;
    const updatedTitle = `${SMOKE_PREFIX}edited-${Date.now()}`;

    // 編集対象のTodoを作成
    await page.getByRole("button", { name: /新規タスク追加|追加|Add/i }).click();
    await page.getByRole("textbox", { name: /タイトル|title/i }).fill(originalTitle);
    await page.getByRole("button", { name: /タスクを作成|保存|Save|Create/i }).click();
    await expect(page.getByText(originalTitle)).toBeVisible();

    // ダイアログが閉じるまで待機（Zustandストアのリセットを待つ）
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(originalTitle)).toBeVisible();

    // 編集ボタンをクリック
    await page.getByRole("button", { name: "Open menu" }).first().click();
    await page.getByText("編集").click();
    
    // 編集ダイアログが開くのを待つ
    await expect(page.getByRole("dialog")).toBeVisible();
    
    const titleInput = page.getByRole("textbox", { name: /タイトル/i });
    await titleInput.clear();
    await titleInput.fill(updatedTitle);
    await page.getByRole("button", { name: /変更を保存/i }).click();

    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByText(originalTitle)).not.toBeVisible();
  });

  test("Todoの削除フロー @smoke", async ({ page }) => {
    const todoTitle = `${SMOKE_PREFIX}delete-${Date.now()}`;

    // 削除対象のTodoを作成
    await page.getByRole("button", { name: /新規タスク追加/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("textbox", { name: /タイトル/i }).fill(todoTitle);
    await page.getByRole("button", { name: /タスクを作成/i }).click();

    // ダイアログが閉じるまで待機
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(todoTitle)).toBeVisible();

    // window.confirmを事前に承認するリスナーを登録
    page.on("dialog", (dialog) => dialog.accept());

    await page.getByRole("button", { name: "Open menu" }).first().click();
    await page.getByRole("menuitem", { name: "削除" }).click();

    await expect(page.getByText(todoTitle)).not.toBeVisible();
  });
});