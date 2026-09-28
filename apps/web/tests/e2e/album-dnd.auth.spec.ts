import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";

const RUN_ID = `${Date.now()}`;

type CreatedImage = { id: string; originalFileName: string };

function buildStorageKey(ext: "png"): string {
  return `uploads/${randomUUID()}.${ext}`;
}

async function createImageViaApi(
  page: Page,
  originalFileName: string,
): Promise<CreatedImage> {
  const res = await page.request.post("/api/images", {
    data: {
      storageKey: buildStorageKey("png"),
      originalFileName,
      mimeType: "image/png",
      fileSize: 1024,
    },
  });
  expect(res.ok(), `画像作成に失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return { id: body.id as string, originalFileName };
}

async function assignImageToAlbum(page: Page, imageId: string, albumId: string) {
  const res = await page.request.patch(`/api/images/${imageId}`, {
    data: { albumId },
  });
  expect(res.ok(), `Album割り当てに失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
}

async function getAlbumIdByName(page: Page, albumName: string): Promise<string> {
  const res = await page.request.get("/api/albums");
  expect(res.ok()).toBeTruthy();
  const albums: Array<{ id: string; name: string }> = await res.json();
  const found = albums.find((a) => a.name === albumName);
  if (!found) throw new Error(`Album "${albumName}" が見つかりません`);
  return found.id;
}

async function createAlbumViaUI(page: Page, albumName: string) {
  await page.getByRole("button", { name: "新規アルバム" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("アルバム名").fill(albumName);
  await dialog.getByRole("button", { name: "作成" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(albumName, { exact: true })).toBeVisible();
}

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

// dnd-kit PointerSensor（activationConstraint: distance 8）のアクティブ化と、
// 衝突判定（over）の更新はどちらもブラウザの描画/イベントループサイクルに依存する。
// down直後・move中を単一のCDPコマンド（stepsオプション）に任せず、複数回の
// 独立したmouse.move呼び出しに分割することで、各段階でdnd-kit側の処理機会を
// 確実に与える。固定のwaitForTimeoutではなく、DragOverlay内のプレビュー表示を
// 「ドラッグが実際にアクティブ化された」ことの状態確認として利用する。
async function dragImageOnto(page: Page, sourceFileName: string, targetFileName: string) {
  const sourceHandle = page.getByRole("button", {
    name: `${sourceFileName}を並び替え`,
    exact: true,
  });
  const targetHandle = page.getByRole("button", {
    name: `${targetFileName}を並び替え`,
    exact: true,
  });

  await sourceHandle.hover();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("ドラッグ対象の座標が取得できません");

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  // ドラッグ中はカード本体とDragOverlayの両方に同名altの<img>が存在しうるため
  // .last()でDragOverlay側（最後にレンダリングされる）を指す。
  const dragPreview = page.getByAltText(sourceFileName).last();

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 15, startY);
  await expect(dragPreview).toBeVisible();

  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    await page.mouse.move(x, y);
  }

  // 目的地到達後、dnd-kitの衝突判定(rectIntersection)がRAFで更新される
  // 機会を作るため、着地点付近でもう一度小さく往復させる。
  await page.mouse.move(endX + 1, endY);
  await page.mouse.move(endX, endY);

  await page.mouse.up();
}

async function getImageOrder(page: Page): Promise<string[]> {
  const imgs = page.locator(`img[alt^="e2e-dnd-${RUN_ID}-"]`);
  const alts = await imgs.evaluateAll((els) =>
    els.map((el) => el.getAttribute("alt") ?? ""),
  );
  return alts;
}

test.describe("Albumページ - 画像並び替え(DnD) (認証済み)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/albums", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "アルバム管理", exact: true }),
    ).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
  });

  test("Album内画像をドラッグで並び替えると順序が変わり、リロード後も保持される", async ({ page }) => {
    const albumName = `e2e-dnd-album-${RUN_ID}`;
    const fileNames = [
      `e2e-dnd-${RUN_ID}-1.png`,
      `e2e-dnd-${RUN_ID}-2.png`,
      `e2e-dnd-${RUN_ID}-3.png`,
    ];

    let albumCreated = false;

    try {
      await createAlbumViaUI(page, albumName);
      albumCreated = true;
      const albumId = await getAlbumIdByName(page, albumName);

      const created: CreatedImage[] = [];
      for (const fileName of fileNames) {
        created.push(await createImageViaApi(page, fileName));
      }
      for (const image of created) {
        await assignImageToAlbum(page, image.id, albumId);
      }

      await page.getByText(albumName, { exact: true }).click();
      await expect(page.getByAltText(fileNames[0])).toBeVisible();
      await expect(page.getByAltText(fileNames[1])).toBeVisible();
      await expect(page.getByAltText(fileNames[2])).toBeVisible();

      const initialOrder = await getImageOrder(page);
      expect(initialOrder).toEqual(fileNames);

      // 3番目の画像を1番目の位置へドラッグ
      await dragImageOnto(page, fileNames[2], fileNames[0]);

      const reorderedInMemory = [fileNames[2], fileNames[0], fileNames[1]];
      // DnD完了後、10秒以内にUI上の並び順が期待通りに更新されることを確認する
      await expect(async () => {
        expect(await getImageOrder(page)).toEqual(reorderedInMemory);
      }).toPass({ timeout: 10_000 });

      // リロード後も並び順がDBに保持されていることを確認する
      await page.reload({ waitUntil: "networkidle" });
      await page.getByText(albumName, { exact: true }).click();
      await expect(page.getByAltText(fileNames[2])).toBeVisible();

      const persistedOrder = await getImageOrder(page);
      expect(persistedOrder).toEqual(reorderedInMemory);
    } finally {
      if (albumCreated) {
        try {
          await deleteAlbumViaUI(page, albumName);
        } catch (cleanupError) {
          console.error(
            "cleanup失敗（本来のテスト結果には影響しません）:",
            cleanupError,
          );
        }
      }
    }
  });
});