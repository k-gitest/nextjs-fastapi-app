import type { Locator, Page } from "@playwright/test";
import { randomUUID } from "crypto";
import {
  test,
  expect,
  type CleanupRegistry,
} from "../test-utils/e2e-cleanup";

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

// 画像を作成してAlbumへ割り当てる。
// 作成〜割り当ての間でテストが失敗すると画像が未所属のまま残るため、作成直後に
// cleanupへ登録し、Albumへ割り当てできた時点で外す（Album配下の画像はAlbum削除と
// 同時に削除されるため、個別のDELETEは不要）。
async function createImageInAlbum(
  page: Page,
  cleanup: CleanupRegistry,
  originalFileName: string,
  albumId: string,
): Promise<CreatedImage> {
  const image = await createImageViaApi(page, originalFileName);
  cleanup.trackImage(image.id);
  await assignImageToAlbum(page, image.id, albumId);
  cleanup.untrackImage(image.id);
  return image;
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

type DragOptions = {
  sourceHandle: Locator;
  targetLocator: Locator;
  /** DragOverlay内のプレビュー<img>のalt（=ドラッグ元画像のファイル名） */
  previewAlt: string;
  /**
   * ドラッグ元のカード本体（ハンドルの親）。指定した場合、dnd-kitが衝突判定に
   * 使う「ドラッグ中の矩形」の中心がtargetの中心に来るよう、終点を補正する。
   * rectIntersectionはポインタ位置ではなくドラッグ矩形で判定するため、
   * ハンドルがカードの隅にある場合にポインタをtargetに合わせただけでは
   * 隣接するdroppableと交差してしまうことがある。
   */
  sourceBody?: Locator;
};

// dnd-kit PointerSensor（activationConstraint: distance 8）のアクティブ化と、
// 衝突判定（over）の更新はどちらもブラウザの描画/イベントループサイクルに依存する。
// down直後・move中を単一のCDPコマンド（stepsオプション）に任せず、複数回の
// 独立したmouse.move呼び出しに分割することで、各段階でdnd-kit側の処理機会を
// 確実に与える。固定のwaitForTimeoutではなく、DragOverlay内のプレビュー表示を
// 「ドラッグが実際にアクティブ化された」ことの状態確認として利用する。
async function dragHandleTo(
  page: Page,
  { sourceHandle, targetLocator, previewAlt, sourceBody }: DragOptions,
) {
  await sourceHandle.hover();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetLocator.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("ドラッグ対象の座標が取得できません");

  let offsetX = 0;
  let offsetY = 0;
  if (sourceBody) {
    const bodyBox = await sourceBody.boundingBox();
    if (!bodyBox) throw new Error("ドラッグ元カードの座標が取得できません");
    offsetX = bodyBox.x + bodyBox.width / 2 - (sourceBox.x + sourceBox.width / 2);
    offsetY = bodyBox.y + bodyBox.height / 2 - (sourceBox.y + sourceBox.height / 2);
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2 - offsetX;
  const endY = targetBox.y + targetBox.height / 2 - offsetY;

  // ドラッグ中はカード本体とDragOverlayの両方に同名altの<img>が存在しうるため
  // .last()でDragOverlay側（最後にレンダリングされる）を指す。
  const dragPreview = page.getByAltText(previewAlt).last();

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

// Album内画像 → Album内画像（並び替え）。
// waitForCompletion=false の場合はPATCH完了を待たずに制御を返す。
// reorder APIを意図的に遅延/失敗させるテスト（route()でレスポンスを保留する場合）では
// 待機すると呼び出し元のゲート開放より先に待ってしまいデッドロックするため、
// そうしたテストではfalseを指定し、完了確認は呼び出し元で行う。
async function dragImageOnto(
  page: Page,
  albumId: string,
  sourceFileName: string,
  targetFileName: string,
  options: { waitForCompletion?: boolean } = {},
) {
  const { waitForCompletion = true } = options;

  const patchPromise = waitForCompletion
    ? page.waitForResponse(
      (res) =>
        res.url().includes(`/api/albums/${albumId}/reorder`) &&
        res.request().method() === "PATCH",
      { timeout: 15_000 },
    )
    : null;
  patchPromise?.catch(() => { });

  await dragHandleTo(page, {
    sourceHandle: page.getByRole("button", {
      name: `${sourceFileName}を並び替え`,
      exact: true,
    }),
    targetLocator: page.getByRole("button", {
      name: `${targetFileName}を並び替え`,
      exact: true,
    }),
    previewAlt: sourceFileName,
  });

  if (patchPromise) {
    const res = await patchPromise;
    expect(res.ok(), `並び替えに失敗: ${res.status()}`).toBeTruthy();
  }
}

// 未所属画像 → 任意のdrop先（Album行・展開済みAlbum詳細領域）。
// ドロップ後、Album移動のPATCHが完了するまで待つ（完了前にreloadすると
// リクエストが中断され、永続化の検証が不安定になるため）。
async function dropUnassignedImageOn(
  page: Page,
  image: CreatedImage,
  targetLocator: Locator,
) {
  const handle = page.getByRole("button", {
    name: `${image.originalFileName}をドラッグしてアルバムへ移動`,
    exact: true,
  });

  const patchPromise = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/images/${image.id}`) &&
      res.request().method() === "PATCH",
    { timeout: 15_000 },
  );
  // dragが先に失敗した場合の未処理rejectionを防ぐ
  patchPromise.catch(() => { });

  await dragHandleTo(page, {
    sourceHandle: handle,
    sourceBody: handle.locator(".."),
    targetLocator,
    previewAlt: image.originalFileName,
  });

  const res = await patchPromise;
  expect(res.ok(), `Album移動に失敗: ${res.status()}`).toBeTruthy();
}

// 展開済みAlbumの詳細領域（AlbumItemのwrapper配下の展開エリア）。
function albumDetailArea(page: Page, albumName: string): Locator {
  return page
    .locator("div.rounded-md")
    .filter({ has: page.getByText(albumName, { exact: true }) })
    .locator("div.bg-muted\\/50")
    .first();
}

async function getImageOrder(page: Page): Promise<string[]> {
  const imgs = page.locator(`img[alt^="e2e-dnd-${RUN_ID}-"]`);
  const alts = await imgs.evaluateAll((els) =>
    els.map((el) => el.getAttribute("alt") ?? ""),
  );
  return alts;
}

// 明示的に開放するまでroute handlerを保留するためのゲート。
function createGate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

// テストデータ（Album・未所属Image）のcleanupは、各テストで登録した内容に基づき
// e2e-cleanup fixtureのteardownがAPI経由で行う。
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

  test("Album内画像をドラッグで並び替えると順序が変わり、リロード後も保持される", async ({ page, cleanup }) => {
    const albumName = `e2e-dnd-album-${RUN_ID}`;
    const fileNames = [
      `e2e-dnd-${RUN_ID}-1.png`,
      `e2e-dnd-${RUN_ID}-2.png`,
      `e2e-dnd-${RUN_ID}-3.png`,
    ];

    cleanup.trackAlbum(albumName);
    await createAlbumViaUI(page, albumName);
    const albumId = await getAlbumIdByName(page, albumName);

    for (const fileName of fileNames) {
      await createImageInAlbum(page, cleanup, fileName, albumId);
    }

    await page.getByText(albumName, { exact: true }).click();
    await expect(page.getByAltText(fileNames[0])).toBeVisible();
    await expect(page.getByAltText(fileNames[1])).toBeVisible();
    await expect(page.getByAltText(fileNames[2])).toBeVisible();

    const initialOrder = await getImageOrder(page);
    expect(initialOrder).toEqual(fileNames);

    // 3番目の画像を1番目の位置へドラッグ
    await dragImageOnto(page, albumId, fileNames[2], fileNames[0]);

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
  });
});

test.describe("Albumページ - 未所属画像→Albumへのドラッグ移動 (認証済み)", () => {
  // 未所属セクションはAlbum一覧の下にあり、Album展開時はさらに下へ伸びる。
  // dnd-kit操作はmouse座標（ビューポート基準）で行うため、ドラッグ元・
  // ドロップ先が同時にビューポートへ収まる高さを確保する。
  test.use({ viewport: { width: 1280, height: 1600 } });

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

  test("未所属画像を未展開のAlbumへドロップすると移動し、リロード後も保持される", async ({ page, cleanup }) => {
    const albumName = `e2e-dnd-unassigned-album-${RUN_ID}-collapsed`;
    const fileName = `e2e-dnd-unassigned-${RUN_ID}-collapsed.png`;

    cleanup.trackAlbum(albumName);
    await createAlbumViaUI(page, albumName);

    // テストが途中で失敗すると画像は未所属のまま残るため、個別に削除対象として登録する。
    // Albumへ移動できた場合はAlbum削除と同時に消えるが、その場合のImage DELETEは
    // 404となり、cleanupは成功扱いにする。
    const image = await createImageViaApi(page, fileName);
    cleanup.trackImage(image.id);

    // 作成した未所属画像を一覧へ反映させる
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByAltText(fileName)).toBeVisible();

    // Albumは展開しない（未展開のAlbum行へドロップする）
    await dropUnassignedImageOn(
      page,
      image,
      page.getByText(albumName, { exact: true }),
    );

    // 未所属一覧から消える（未展開のため他の場所にも表示されない）
    await expect(page.getByAltText(fileName)).toHaveCount(0);

    // リロード後も未所属に戻らず、Albumの所属画像として保持される
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByAltText(fileName)).toHaveCount(0);

    await page.getByText(albumName, { exact: true }).click();
    await expect(page.getByAltText(fileName)).toBeVisible();
  });

  test("未所属画像を展開済みAlbumの詳細領域へドロップしても移動し、リロード後も保持される", async ({ page, cleanup }) => {
    const albumName = `e2e-dnd-unassigned-album-${RUN_ID}-expanded`;
    const fileName = `e2e-dnd-unassigned-${RUN_ID}-expanded.png`;

    cleanup.trackAlbum(albumName);
    await createAlbumViaUI(page, albumName);

    const image = await createImageViaApi(page, fileName);
    cleanup.trackImage(image.id);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByAltText(fileName)).toBeVisible();

    // 空のAlbumを展開し、その詳細領域をドロップ先にする。
    // 画像が既にある場合、画像カード上へのドロップはAlbum内画像扱いの
    // over判定になり得るため、空のAlbumの余白領域を対象にする。
    await page.getByText(albumName, { exact: true }).click();
    const detail = albumDetailArea(page, albumName);
    await expect(detail).toBeVisible();
    // AlbumDetailの取得完了（Suspense fallbackの解除）を、空Albumの表示テキストで確認する。
    // 詳細領域の高さが確定する前にdrop先の座標を取らないための待機。
    await expect(
      detail.getByText("このアルバムにはまだ画像がありません"),
    ).toBeVisible();

    await dropUnassignedImageOn(page, image, detail);

    // Albumの詳細領域に表示される（=未所属一覧側からは消えて合計1件になる）
    await expect(detail.getByAltText(fileName)).toBeVisible();
    await expect(page.getByAltText(fileName)).toHaveCount(1);

    // リロード後も保持される
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByAltText(fileName)).toHaveCount(0);

    await page.getByText(albumName, { exact: true }).click();
    await expect(albumDetailArea(page, albumName).getByAltText(fileName)).toBeVisible();
  });

  test("reorder APIが失敗すると楽観的更新がrollbackされ、再取得の完了前に元の順序へ戻る", async ({ page, cleanup }) => {
    test.setTimeout(60_000); // API作成3件+DnD+reloadを含むため既定30秒では余裕が乏しい
    const albumName = `e2e-dnd-rollback-album-${RUN_ID}`;
    const fileNames = [
      `e2e-dnd-${RUN_ID}-r1.png`,
      `e2e-dnd-${RUN_ID}-r2.png`,
      `e2e-dnd-${RUN_ID}-r3.png`,
    ];

    const reorderGate = createGate();
    const detailGate = createGate();

    cleanup.trackAlbum(albumName);

    try {
      await createAlbumViaUI(page, albumName);
      const albumId = await getAlbumIdByName(page, albumName);

      for (const fileName of fileNames) {
        await createImageInAlbum(page, cleanup, fileName, albumId);
      }

      await page.getByText(albumName, { exact: true }).click();
      for (const fileName of fileNames) {
        await expect(page.getByAltText(fileName)).toBeVisible();
      }
      expect(await getImageOrder(page)).toEqual(fileNames);

      // 障害注入は、展開・初期表示が完了した「あと」に張る（通常のdetail取得を巻き込まない）。
      // URL末尾を$で固定し、メソッドで絞る。対象外は実バックエンドへ流す。
      const reorderUrl = new RegExp(`/api/albums/${albumId}/reorder$`);
      const detailUrl = new RegExp(`/api/albums/${albumId}$`);
      let reorderCount = 0;

      await page.route(reorderUrl, async (route) => {
        if (route.request().method() !== "PATCH") return route.fallback();
        reorderCount++;
        await reorderGate.promise; // 楽観的更新を観測するまで保留
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "e2e injected reorder failure" }),
        });
      });
      await page.route(detailUrl, async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        await detailGate.promise; // rollbackを観測するまでrefetchを保留
        await route.continue();
      });

      // 3番目を1番目の位置へドラッグ
      // reorder APIをrouteで意図的に保留するため、PATCH完了は待たない。
      // 完了確認はこの後の optimisticOrder / detailRequested / rollback確認で行う。
      await dragImageOnto(page, albumId, fileNames[2], fileNames[0], {
        waitForCompletion: false,
      });

      // 1. 楽観的更新（PATCH保留中なので確実に観測できる）
      const optimisticOrder = [fileNames[2], fileNames[0], fileNames[1]];
      await expect(async () => {
        expect(await getImageOrder(page)).toEqual(optimisticOrder);
      }).toPass({ timeout: 10_000 });

      // 2-3. PATCHを500で失敗させる。onSettledのdetail GETが発行され、保留されることを確認
      const detailRequested = page.waitForRequest(
        (req) => detailUrl.test(req.url()) && req.method() === "GET",
        { timeout: 5_000 },
      );
      reorderGate.open();
      await detailRequested;

      // 4. GETは保留中のまま、onErrorのrollbackで元の順序に戻る
      await expect(async () => {
        expect(await getImageOrder(page)).toEqual(fileNames);
      }).toPass({ timeout: 10_000 });
      expect(reorderCount).toBe(1); // retryで複数回飛んでいないこと

      // 5-6. GETを解除し、再取得後も元の順序であること（サーバー側も未変更）
      detailGate.open();
      await page.reload({ waitUntil: "networkidle" });
      await page.getByText(albumName, { exact: true }).click();
      await expect(page.getByAltText(fileNames[0])).toBeVisible();
      expect(await getImageOrder(page)).toEqual(fileNames);
    } finally {
      // 失敗時にゲートが閉じたままだとrouteのhandlerが保留され続けるため、
      // 必ず開放して注入を解除する。Albumのcleanupはfixtureのteardownが行う。
      reorderGate.open();
      detailGate.open();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
});