import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { AlbumImageGrid } from "@/features/albums/components/AlbumImageGrid";
import type { AlbumImageItem, Album } from "@/features/albums/types";

/**
 * Radix UI（shadcn/ui Select・AlertDialog）は jsdom に存在しない DOM API
 * （PointerEvent・hasPointerCapture・scrollIntoView）に依存するため、
 * このテストファイル内に限定してポリフィルを当てる。
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
  const mockOnReorder = vi.fn();

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
        onReorder={mockOnReorder}
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
        onReorder={mockOnReorder}
      />,
    );

    expect(screen.getByAltText("photo1.png")).toBeInTheDocument();
    expect(screen.getByAltText("photo2.png")).toBeInTheDocument();

    expect(screen.getByText("2件で使用中")).toBeInTheDocument();
    expect(screen.queryByText("0件で使用中")).not.toBeInTheDocument();
  });

  it("各画像に並び替え用のドラッグハンドルが表示されること", () => {
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
        onReorder={mockOnReorder}
      />,
    );

    expect(
      screen.getByRole("button", { name: "photo1.pngを並び替え" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "photo2.pngを並び替え" }),
    ).toBeInTheDocument();
  });

  it("otherAlbumsで渡されたAlbumが移動先候補として選択できること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumImageGrid
        images={mockImages}
        otherAlbums={mockOtherAlbums}
        onDelete={mockOnDelete}
        onMove={mockOnMove}
        onReorder={mockOnReorder}
      />,
    );

    const [photo1Trigger] = screen.getAllByRole("combobox");
    await user.click(photo1Trigger);

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
        onReorder={mockOnReorder}
      />,
    );

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
        onReorder={mockOnReorder}
      />,
    );

    const [, photo2Trigger] = screen.getAllByRole("combobox");
    await user.click(photo2Trigger);

    const unassignOption = await screen.findByRole("option", {
      name: "未所属に戻す",
    });
    await user.click(unassignOption);

    expect(mockOnMove).toHaveBeenCalledTimes(1);
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
        onReorder={mockOnReorder}
        moving={true}
      />,
    );

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
        onReorder={mockOnReorder}
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
        onReorder={mockOnReorder}
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
        onReorder={mockOnReorder}
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
        onReorder={mockOnReorder}
        deleting={true}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: "photo1.pngを削除" });
    expect(deleteBtn).toBeDisabled();
  });
});