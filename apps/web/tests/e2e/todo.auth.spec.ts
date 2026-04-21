import { test, expect } from "@playwright/test";

test.describe("Todoページ (認証済み)", () => {
  test.beforeEach(async ({ page }) => {
    // Todoページへ移動
    await page.goto("/todo");
    // AsyncBoundary (Suspense) が解決し、ページが表示されるまで待機
    await expect(
      page.getByRole("heading", { name: "TODO", exact: true }),
    ).toBeVisible();
  });

  test("初期表示：見出しとレイアウトが正しく表示されること", async ({
    page,
  }) => {
    // 1. ページタイトルの確認
    const description = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: "TODO" }) })
      .getByText("現在のタスク状況と進捗統計を確認できます。");
    await expect(description).toBeVisible();

    // 2. セクション見出しの確認
    await expect(
      page.getByRole("heading", { name: "マイタスク" }),
    ).toBeVisible();

    // 3. 統計チャート（Container）が描画されているか
    // ※ 内部でCanvasやSVGを使っている場合、コンテナの存在を確認
    await expect(
      page.locator("div:has(> canvas), div:has(> svg)").first(),
    ).toBeVisible();
  });

  test("Todoの新規作成フロー", async ({ page }) => {
    const todoTitle = `E2E作成テスト - ${Date.now()}`;

    // 1. ページ遷移後、少し待機するか、特定の要素が安定するのを待つ
    await page.goto("/todo"); // あなたのアプリのパスに合わせてください

    const triggerButton = page.getByRole("button", { name: "新規タスク追加" });

    // ボタンが「安定」するまで待つ（クリック可能になるまで自動待機）
    // dispatchEvent ではなく、必ず click() を使ってください
    await triggerButton.click();

    // 2. もしクリックしてもダイアログが出ない場合、
    // 「ボタンがクリックされたがJSが間に合わなかった」可能性があるので、
    // 失敗したらもう一度クリックするリトライを入れるか、以下のように見出しを待ちます
    const dialogTitle = page.getByRole("heading", {
      name: "新しいタスクを作成",
    });

    // タイムアウトを少し長めにするか、
    // 出現しない場合は「ボタンをもう一度押す」という処理を検討
    try {
      await expect(dialogTitle).toBeVisible({ timeout: 5000 });
    } catch (e) {
      // 1回目のクリックがハイドレーションで無視された場合の保険
      await triggerButton.click();
      await expect(dialogTitle).toBeVisible({ timeout: 5000 });
    }

    // 3. 入力操作
    // Radix UIのダイアログはDOMの深いところにあるので、pageから直接探すのが安全
    await page.getByPlaceholder(/レポートを作成する/).fill(todoTitle);
    await page.getByRole("button", { name: "タスクを作成" }).click();

    // 4. 反映確認
    await expect(page.getByText(todoTitle)).toBeVisible();
  });

  test("Todoの編集・更新フロー", async ({ page }) => {
    const initialTitle = `編集前タスク - ${Date.now()}`;
    const updatedTitle = `【更新済】${initialTitle}`;

    // --- 1. テストデータの作成 ---
    const triggerButton = page.getByRole("button", { name: "新規タスク追加" });
    await triggerButton.click();

    const inputField = page.getByPlaceholder(/レポートを作成する/);

    try {
      await expect(inputField).toBeVisible({ timeout: 3000 });
    } catch (e) {
      await triggerButton.click();
      await expect(inputField).toBeVisible();
    }

    await inputField.fill(initialTitle);
    await page.getByRole("button", { name: "タスクを作成" }).click();

    // ダイアログが消えるのを待つ
    await expect(inputField).not.toBeVisible();

    // --- 2. 編集アクション (Dropdown操作) ---

    // 【修正ポイント】
    // '.border' ではなく、確実に CardTitle やその周辺のテキストから親の Card を探す
    // page.locator("div") に対して filter({ hasText: initialTitle }) を使い、
    // かつ "Open menu" ボタンを持っているものに絞り込みます
    const todoCard = page
      .locator("div")
      .filter({
        has: page.getByText(initialTitle, { exact: true }),
      })
      .filter({
        has: page.getByRole("button", { name: "Open menu" }),
      })
      .last(); // 念のため、新しく追加された（通常は最後に来る）ものを選択

    await expect(todoCard).toBeVisible({ timeout: 10000 });

    // カード内の「Open menu」ボタンをクリック
    const menuTrigger = todoCard.getByRole("button", { name: "Open menu" });
    await menuTrigger.click();

    // メニューが表示されるのを待って「編集」をクリック
    // Role="menuitem" で探すのが Radix UI では最も確実
    const editMenuItem = page.getByRole("menuitem", { name: "編集" });
    await expect(editMenuItem).toBeVisible();
    await editMenuItem.click();

    // --- 3. 更新操作 ---
    await expect(inputField).toBeVisible();
    await expect(inputField).toHaveValue(initialTitle);

    await inputField.fill(updatedTitle);
    await page.getByRole("button", { name: /保存|更新|save/i }).click();

    // --- 4. 反映確認 ---
    // 新しいタイトルが「完全一致」で表示されているか
    await expect(page.getByText(updatedTitle, { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // 古いタイトル（編集前タスク - XXX）が「完全一致」で存在しないか
    // これにより、"【更新済】編集前タスク - XXX" があってもパスするようになります
    await expect(
      page.getByText(initialTitle, { exact: true }),
    ).not.toBeVisible();
  });

  test("Todoの削除フロー", async ({ page }) => {
    const todoTitle = `削除テスト用タスク - ${Date.now()}`;

    // --- 1. テストデータの作成 ---
    const triggerButton = page.getByRole("button", { name: "新規タスク追加" });
    await triggerButton.click();

    const inputField = page.getByPlaceholder(/レポートを作成する/);

    try {
      await expect(inputField).toBeVisible({ timeout: 3000 });
    } catch (e) {
      await triggerButton.click();
      await expect(inputField).toBeVisible();
    }

    await inputField.fill(todoTitle);
    await page.getByRole("button", { name: "タスクを作成" }).click();

    // ダイアログが消えるのを待つ
    await expect(inputField).not.toBeVisible();

    // --- 2. 削除対象のカードを特定 (更新テストと同じロジック) ---
    const todoCard = page
      .locator("div")
      .filter({
        has: page.getByText(todoTitle, { exact: true }),
      })
      .filter({
        has: page.getByRole("button", { name: "Open menu" }),
      })
      .last();

    await expect(todoCard).toBeVisible({ timeout: 10000 });

    // --- 3. window.confirm のハンドリング設置 ---
    // 削除ボタンを押す前にリスナーを立てる
    page.once("dialog", async (dialog) => {
      // console.log(`Dialog: ${dialog.message()}`); // デバッグ用
      await dialog.accept(); // 「OK」を押す
    });

    // --- 4. 削除アクション (Dropdown操作) ---

    // カード内の「Open menu」をクリック
    const menuTrigger = todoCard.getByRole("button", { name: "Open menu" });
    await menuTrigger.click();

    // メニューが表示されるのを待って「削除」をクリック
    const deleteMenuItem = page.getByRole("menuitem", { name: "削除" });
    await expect(deleteMenuItem).toBeVisible();
    await deleteMenuItem.click();

    // --- 5. 消去確認 ---
    // タイトル（完全一致）がDOMから消えたことを確認
    await expect(page.getByText(todoTitle, { exact: true })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("データがない場合の表示", async ({ page }) => {
    // 全くデータがない時の空状態のメッセージがあれば確認
    // await expect(page.getByText("タスクはありません")).toBeVisible();
  });
});
