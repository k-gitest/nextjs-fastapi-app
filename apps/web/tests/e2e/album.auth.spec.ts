import type { Page } from "@playwright/test";
import { test, expect } from "../test-utils/e2e-cleanup";

test.describe("Albumページ (認証済み)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/albums", { waitUntil: "networkidle" });
        await expect(
            page.getByRole("heading", { name: "アルバム管理", exact: true })
        ).toBeVisible();
    });

    test.afterEach(async ({ page }) => {
        // 削除確認はwindow.confirmではなく自前のAlertDialog（role="alertdialog"）のため両方確認する
        await expect(page.getByRole("dialog")).not.toBeVisible();
        await expect(page.getByRole("alertdialog")).not.toBeVisible();
    });

    // 削除フローそのものを検証するテスト専用のヘルパー。
    // テストデータのcleanupには使わない（cleanupはe2e-cleanup fixtureがAPI経由で行う）。
    async function deleteAlbumViaUI(page: Page, albumName: string) {
        await page
            .getByRole("button", { name: `${albumName}を削除`, exact: true })
            .click();

        const alertDialog = page.getByRole("alertdialog");
        await expect(alertDialog).toBeVisible();
        await alertDialog.getByRole("button", { name: "削除する" }).click();
        await expect(alertDialog).not.toBeVisible();
        await expect(page.getByText(albumName, { exact: true })).not.toBeVisible();
    }

    test("アルバムの新規作成フロー", async ({ page, cleanup }) => {
        const albumName = `e2e-album-${Date.now()}`;
        cleanup.trackAlbum(albumName);

        await page.getByRole("button", { name: "新規アルバム" }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog.getByLabel("アルバム名").fill(albumName);
        await dialog.getByRole("button", { name: "作成" }).click();

        await expect(dialog).not.toBeVisible();
        await expect(page.getByText(albumName, { exact: true })).toBeVisible();

        // リロード後もDB上に保持されていることを確認する
        await page.reload({ waitUntil: "networkidle" });
        await expect(page.getByText(albumName, { exact: true })).toBeVisible();
    });

    test("アルバム名の編集フロー", async ({ page, cleanup }) => {
        const originalName = `e2e-edit-${Date.now()}`;
        const updatedName = `e2e-edited-${Date.now()}`;
        // 編集の途中で失敗した場合も、どちらの名前で残っていても削除できるよう両方登録する
        cleanup.trackAlbum(originalName);
        cleanup.trackAlbum(updatedName);

        // 編集対象のアルバムを作成
        await page.getByRole("button", { name: "新規アルバム" }).click();
        const createDialog = page.getByRole("dialog");
        await createDialog.getByLabel("アルバム名").fill(originalName);
        await createDialog.getByRole("button", { name: "作成" }).click();
        await expect(createDialog).not.toBeVisible();
        await expect(page.getByText(originalName, { exact: true })).toBeVisible();

        // 編集ボタン（aria-label: `${album.name}を編集`）をクリック
        await page
            .getByRole("button", { name: `${originalName}を編集`, exact: true })
            .click();

        const editDialog = page.getByRole("dialog");
        await expect(editDialog).toBeVisible();

        const nameInput = editDialog.getByLabel("アルバム名");
        await nameInput.clear();
        await nameInput.fill(updatedName);
        await editDialog.getByRole("button", { name: "保存" }).click();

        await expect(editDialog).not.toBeVisible();
        await expect(page.getByText(updatedName, { exact: true })).toBeVisible();
        await expect(
            page.getByText(originalName, { exact: true })
        ).not.toBeVisible();
    });

    test("アルバムの削除フロー", async ({ page, cleanup }) => {
        const albumName = `e2e-delete-${Date.now()}`;
        // 削除UIが途中で失敗した場合に備えて登録する。UIで削除できていれば、
        // teardownでは該当Albumが見つからず何も削除しない。
        cleanup.trackAlbum(albumName);

        // 削除対象のアルバムを作成
        await page.getByRole("button", { name: "新規アルバム" }).click();
        const createDialog = page.getByRole("dialog");
        await createDialog.getByLabel("アルバム名").fill(albumName);
        await createDialog.getByRole("button", { name: "作成" }).click();
        await expect(createDialog).not.toBeVisible();
        await expect(page.getByText(albumName, { exact: true })).toBeVisible();

        await deleteAlbumViaUI(page, albumName);
    });

    test("アルバム作成のキャンセル", async ({ page }) => {
        const albumName = `e2e-cancel-${Date.now()}`;

        await page.getByRole("button", { name: "新規アルバム" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("アルバム名").fill(albumName);

        // Escapeで閉じる（Radix Dialogの既定の閉じ方）
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();

        await expect(page.getByText(albumName, { exact: true })).not.toBeVisible();
        // DBには作成されないためcleanup不要
    });
});