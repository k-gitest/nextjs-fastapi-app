import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AlbumItem } from "@/features/albums/components/AlbumItem";
import type { Album } from "@/features/albums/types";

// AlbumItemはAlbumDetailContainerを直接importして展開時に描画するため、
// AlbumItem自体の行・トグル・イベント委譲の挙動を検証するテストでは
// AlbumDetailContainerを軽量スタブに差し替える（配線自体はAlbumPanelの
// integrationテスト側で検証する）。
vi.mock("@/features/albums/components/AlbumDetailContainer", () => ({
  AlbumDetailContainer: ({ albumId }: { albumId: string }) => (
    <div data-testid="album-detail-container">{albumId}</div>
  ),
}));

describe("AlbumItem", () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggleExpand = vi.fn();

  const mockAlbum: Album = {
    id: "album-1",
    name: "夏休み",
    userId: "user-1",
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
  } as Album;

  // 外側の行（role="button"）と、内側の編集・削除ボタン（aria-label="夏休みを編集"等）は
  // いずれも accessible name が "夏休み" から始まるため、name正規表現では一意に特定できない。
  // "夏休み" テキストを持つspanの最近傍にある role="button" 要素（＝行自体）を取得することで
  // 一意性を担保する（closest()はTailwindクラス名等の非意味的な属性ではなくARIA roleに
  // 依存するため、レイアウト変更に対して壊れにくい）。
  const getRow = () =>
    screen.getByText("夏休み").closest('[role="button"]') as HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("album.nameが表示されること", () => {
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    expect(screen.getByText("夏休み")).toBeInTheDocument();
  });

  it("行をクリックするとonToggleExpandがalbumとともに呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    await user.click(screen.getByText("夏休み"));

    expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
    expect(mockOnToggleExpand).toHaveBeenCalledWith(mockAlbum);
  });

  it("行にフォーカスしてEnterキーを押すとonToggleExpandが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    getRow().focus();
    await user.keyboard("{Enter}");

    expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
    expect(mockOnToggleExpand).toHaveBeenCalledWith(mockAlbum);
  });

  it("行にフォーカスしてSpaceキーを押すとonToggleExpandが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    getRow().focus();
    await user.keyboard(" ");

    expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
    expect(mockOnToggleExpand).toHaveBeenCalledWith(mockAlbum);
  });

  it("編集ボタンをクリックするとonEditが呼ばれ、onToggleExpandは呼ばれないこと（stopPropagation）", async () => {
    const user = userEvent.setup();
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    await user.click(screen.getByRole("button", { name: "夏休みを編集" }));

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).toHaveBeenCalledWith(mockAlbum);
    expect(mockOnToggleExpand).not.toHaveBeenCalled();
  });

  it("削除ボタンをクリックするとonDeleteが呼ばれ、onToggleExpandは呼ばれないこと（stopPropagation）", async () => {
    const user = userEvent.setup();
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    await user.click(screen.getByRole("button", { name: "夏休みを削除" }));

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockAlbum);
    expect(mockOnToggleExpand).not.toHaveBeenCalled();
  });

  it("expandedがtrueのとき、展開中を示すスタイルが適用されること", () => {
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expanded={true}
      />,
    );

    const row = getRow();
    expect(row).toHaveClass("border-primary");
    expect(row).toHaveClass("bg-accent");
    expect(row).toHaveAttribute("aria-expanded", "true");
  });

  it("expandedがfalse（未指定）のとき、展開中スタイルが適用されないこと", () => {
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    const row = getRow();
    expect(row).not.toHaveClass("border-primary");
    expect(row).toHaveAttribute("aria-expanded", "false");
  });

  it("disabledがtrueのとき、編集・削除ボタンがdisabledになること", () => {
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        disabled={true}
      />,
    );

    expect(screen.getByRole("button", { name: "夏休みを編集" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "夏休みを削除" })).toBeDisabled();
  });

  it("expandedがtrueのとき、AlbumDetailContainerがそのalbumIdで表示されること", () => {
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expanded={true}
      />,
    );

    expect(screen.getByTestId("album-detail-container")).toHaveTextContent(
      "album-1",
    );
  });

  it("expandedがfalse（未指定）のとき、AlbumDetailContainerが表示されないこと", () => {
    render(
      <AlbumItem
        album={mockAlbum}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
      />,
    );

    expect(
      screen.queryByTestId("album-detail-container"),
    ).not.toBeInTheDocument();
  });
});