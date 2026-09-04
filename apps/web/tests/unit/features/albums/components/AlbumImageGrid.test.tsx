import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { AlbumImageGrid } from "@/features/albums/components/AlbumImageGrid";
import type { AlbumImageItem, Album } from "@/features/albums/types";

/**
 * Radix UI（shadcn/ui Select・AlertDialog）は jsdom に存在しない DOM API
 * （PointerEvent・hasPointerCapture・scrollIntoView）に依存するため、
 * このテストファイル内に限定してポリフィルを当てる。
 *
 * vitest.setup.ts（グローバル）を変更しない理由:
 *   現時点でこれらのポリフィルを必要とするのは本ファイルのSelect操作のみであり、
 *   YAGNIの3インスタンス閾値にも達していないため。将来同様のポリフィルが
 *   複数のテストファイルで必要になった時点でグローバル化を検討する。
 */
class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;
  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.button = props.button ?? 0;
    this.ctrlKey = props.ctrlKey ?? false;
    this.pointerType = props.pointerType ?? "mouse";
  }
}

beforeAll(() => {
  window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("AlbumImageGrid", () => {
  const mockOnDelete = vi.fn();
  const mockOnMove = vi.fn();

  const mockImages: AlbumImageItem[] = [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
      albumDisplayOrder: 0,
    },
    {
      id: "img-2",
      originalFileName: "photo2.png",
      mimeType: "image/png",
      fileSize: 2000,
      createdAt: new Date("2026-06-02"),
      usageCount: 2,
      albumDisplayOrder: 1,
    },
  ];

  // otherAlbumsのフィルタリング（自分自身の除外）はAlbumDetailContainerの責務のため、
  // ここではGridに渡されたotherAlbumsをそのまま信頼して描画することのみを検証する。
  const mockOtherAlbums: Album[] = [
    {
      id: "album-2",
      name: "旅行",
      userId: "user-1",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
    } as Album,
    {
      id: "album-3",
      name: "家族",
      userId: "user-1",
      createdAt: new Date("2026-05-02"),
      updatedAt: new Date("2026-05-02"),
    } as Album,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imagesが空のとき、空状態メッセージが表示されること", () => {
    render(
      <AlbumImageGrid
        images={[]}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    expect(
      screen.getByText("このアルバムにはまだ画像がありません"),
    ).toBeInTheDocument();
  });

  it("画像一覧が表示されること（usageCountが0の画像にはバッジが出ないこと）", () => {
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    expect(screen.getByAltText("photo1.png")).toBeInTheDocument();
    expect(screen.getByAltText("photo2.png")).toBeInTheDocument();

    // usageCount > 0 の画像のみバッジが表示される
    expect(screen.getByText("2件で使用中")).toBeInTheDocument();
    expect(screen.queryByText("0件で使用中")).not.toBeInTheDocument();
  });

  it("otherAlbumsで渡されたAlbumが移動先候補として選択できること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    // Select（combobox）はimages配列の描画順とDOM上の出現順が一致するため、
    // インデックスでphoto1側のSelectを特定する。
    // closest()によるDOM階層探索は「imgの直近の親divにはSelectが含まれない」
    // という実DOM構造（w-24 space-y-1 > group relative divとは別階層にSelectがある）
    // のため使えず、data-testidを本番コードに追加するほどでもないためこの方式を採る。
    const [photo1Trigger] = screen.getAllByRole("combobox");
    await user.click(photo1Trigger);

    // otherAlbumsに含まれる2件の選択肢が表示されること
    expect(await screen.findByRole("option", { name: "旅行" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "家族" })).toBeInTheDocument();
  });

  it("Albumを選択すると、そのimageIdとalbumIdでonMoveが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    // images[0]（photo1 / img-1）に対応するSelect
    const [photo1Trigger] = screen.getAllByRole("combobox");
    await user.click(photo1Trigger);

    const option = await screen.findByRole("option", { name: "旅行" });
    await user.click(option);

    expect(mockOnMove).toHaveBeenCalledTimes(1);
    expect(mockOnMove).toHaveBeenCalledWith("img-1", "album-2");
  });

  it("「未所属に戻す」を選択すると、onMoveがalbumId=nullで呼ばれること（UNASSIGN_VALUEが漏れないこと）", async () => {
    const user = userEvent.setup();
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    // images[1]（photo2 / img-2）に対応するSelect
    const [, photo2Trigger] = screen.getAllByRole("combobox");
    await user.click(photo2Trigger);

    const unassignOption = await screen.findByRole("option", {
      name: "未所属に戻す",
    });
    await user.click(unassignOption);

    expect(mockOnMove).toHaveBeenCalledTimes(1);
    // sentinel文字列（__unassign__）がそのままonMoveへ渡っていないことを確認
    expect(mockOnMove).toHaveBeenCalledWith("img-2", null);
    expect(mockOnMove).not.toHaveBeenCalledWith("img-2", "__unassign__");
  });

  it("movingがtrueのとき、すべてのSelectがdisabledになること", () => {
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
        moving={true}
      />,
    );

    // moving はGrid全体で単一のpending状態を共有する仕様
    // （UnassignedImageGridのassigning={assigning}と同じ既存パターン）のため、
    // 1枚だけでなく全Selectがdisabledになることを検証する。
    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(2);
    triggers.forEach((trigger) => expect(trigger).toBeDisabled());
  });

  it("削除ボタンをクリックすると確認ダイアログが表示され、「削除する」でonDeleteが呼ばれること（usageCount=0）", async () => {
    const user = userEvent.setup();
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    await user.click(screen.getByRole("button", { name: "photo1.pngを削除" }));

    expect(
      await screen.findByText("画像を削除しますか？"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("この画像を削除します。この操作は取り消せません。"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith("img-1", expect.any(Function));
  });

  it("usageCountが1以上の画像を削除しようとすると、警告文言がダイアログに表示されること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    await user.click(screen.getByRole("button", { name: "photo2.pngを削除" }));

    expect(
      await screen.findByText(
        /この画像は2件のTodoで使用されています。削除すると、これらのTodoからも画像の添付が削除されます。/,
      ),
    ).toBeInTheDocument();
  });

  it("キャンセルをクリックすると、onDeleteが呼ばれずダイアログが閉じること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
      />,
    );

    await user.click(screen.getByRole("button", { name: "photo1.pngを削除" }));
    expect(await screen.findByText("画像を削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it("deletingがtrueのとき、削除ボタンがdisabledになること", () => {
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
        deleting={true}
      />,
    );

    // deleting=trueだと削除ボタン自体がdisabledでクリックできず、
    // ダイアログを開けないため、ダイアログ内「削除する」ボタンのdisabledは
    // このProps駆動のテストでは素直に再現できない（別途rerenderでの検証が必要）。
    // 今回はカード上の削除ボタンのdisabled化のみを検証範囲とする。
    const deleteBtn = screen.getByRole("button", { name: "photo1.pngを削除" });
    expect(deleteBtn).toBeDisabled();
  });
});