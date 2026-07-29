import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { UnassignedImageGrid } from "@/features/images/components/UnassignedImageGrid";
import type { ImageSummary } from "@/features/images/types";
import type { Album } from "@/features/albums/types";

/**
 * Radix UI（shadcn/ui Select・AlertDialog）は jsdom に存在しない DOM API
 * （PointerEvent・hasPointerCapture・scrollIntoView）に依存するため、
 * このテストファイル内に限定してポリフィルを当てる。
 * AlbumImageGrid.test.tsxと同一パターン（YAGNIの3インスタンス閾値未達のためファイル内限定）。
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

describe("UnassignedImageGrid", () => {
  const mockOnDelete = vi.fn();
  const mockOnUpdateAlbum = vi.fn();

  const mockImages: ImageSummary[] = [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
    },
    {
      id: "img-2",
      originalFileName: "photo2.png",
      mimeType: "image/png",
      fileSize: 2000,
      createdAt: new Date("2026-06-02"),
      usageCount: 2,
    },
  ];

  const mockAlbums: Album[] = [
    {
      id: "album-1",
      name: "夏休み",
      userId: "user-1",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
    } as Album,
    {
      id: "album-2",
      name: "旅行",
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
      <UnassignedImageGrid
        images={[]}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
      />,
    );

    expect(
      screen.getByText("未所属の画像はありません"),
    ).toBeInTheDocument();
  });

  it("画像一覧が表示されること（usageCountが0の画像にはバッジが出ないこと）", () => {
    render(
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
      />,
    );

    expect(screen.getByAltText("photo1.png")).toBeInTheDocument();
    expect(screen.getByAltText("photo2.png")).toBeInTheDocument();

    expect(screen.getByText("2件で使用中")).toBeInTheDocument();
    expect(screen.queryByText("0件で使用中")).not.toBeInTheDocument();
  });

  it("albumsが空のとき、Select自体が表示されないこと", () => {
    render(
      <UnassignedImageGrid
        images={mockImages}
        albums={[]}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
      />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("albumsで渡されたAlbumが移動先候補として選択できること", async () => {
    const user = userEvent.setup();
    render(
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
      />,
    );

    const [photo1Trigger] = screen.getAllByRole("combobox");
    await user.click(photo1Trigger);

    expect(await screen.findByRole("option", { name: "夏休み" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "旅行" })).toBeInTheDocument();
  });

  it("Albumを選択すると、そのimageIdとalbumIdでonUpdateAlbumが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
      />,
    );

    // images[1]（photo2 / img-2）に対応するSelect
    const [, photo2Trigger] = screen.getAllByRole("combobox");
    await user.click(photo2Trigger);

    const option = await screen.findByRole("option", { name: "旅行" });
    await user.click(option);

    expect(mockOnUpdateAlbum).toHaveBeenCalledTimes(1);
    expect(mockOnUpdateAlbum).toHaveBeenCalledWith("img-2", "album-2");
  });

  it("assigningがtrueのとき、すべてのSelectがdisabledになること", () => {
    render(
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
        assigning={true}
      />,
    );

    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(2);
    triggers.forEach((trigger) => expect(trigger).toBeDisabled());
  });

  it("削除ボタンをクリックすると確認ダイアログが表示され、「削除する」でonDeleteが呼ばれること（usageCount=0）", async () => {
    const user = userEvent.setup();
    render(
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
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
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
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
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
      />,
    );

    await user.click(screen.getByRole("button", { name: "photo1.pngを削除" }));
    expect(await screen.findByText("画像を削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it("deletingがtrueのとき、削除ボタンがdisabledになること", () => {
    render(
      <UnassignedImageGrid
        images={mockImages}
        albums={mockAlbums}
        onDelete={mockOnDelete}
        onUpdateAlbum={mockOnUpdateAlbum}
        deleting={true}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: "photo1.pngを削除" });
    expect(deleteBtn).toBeDisabled();
  });
});