import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AlbumList } from "@/features/albums/components/AlbumList";
import type { Album } from "@/features/albums/types";

// AlbumListは各行をAlbumItemとして描画し、AlbumItemはAlbumDetailContainerを
// 直接importして展開時に描画する。AlbumList自体のprops受け渡し・スタイル判定を
// 検証する範囲では、AlbumDetailContainerを軽量スタブに差し替える。
vi.mock("@/features/albums/components/AlbumDetailContainer", () => ({
  AlbumDetailContainer: ({ albumId }: { albumId: string }) => (
    <div data-testid="album-detail-container">{albumId}</div>
  ),
}));

describe("AlbumList", () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggleExpand = vi.fn();

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
    {
      id: "album-3",
      name: "家族",
      userId: "user-1",
      createdAt: new Date("2026-05-03"),
      updatedAt: new Date("2026-05-03"),
    } as Album,
  ];

  // AlbumItemはAlbumItem.test.tsxで単体テスト済みのため、ここではモックせず実物を
  // そのまま描画する（TodoListContainer.integration.test.tsxが実際のTodoItemを
  // モックせず描画しているのと同じ考え方。AlbumList自体はフックを持たない
  // 単純なmapのみのPresentational Componentのため、Containerのような
  // hookモック方式ではなくunit testとして扱う）。
  const getRowByName = (name: string) =>
    screen.getByText(name).closest('[role="button"]') as HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("albumsが空のとき、空状態メッセージが表示されること", () => {
    render(
      <AlbumList
        albums={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={[]}
      />,
    );

    expect(
      screen.getByText("アルバムがありません。最初のアルバムを作成してください。"),
    ).toBeInTheDocument();
  });

  it("albumsの件数分、名前が表示されること", () => {
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={[]}
      />,
    );

    expect(screen.getByText("夏休み")).toBeInTheDocument();
    expect(screen.getByText("旅行")).toBeInTheDocument();
    expect(screen.getByText("家族")).toBeInTheDocument();
  });

  it("expandedAlbumIdsに一致するAlbumのみ展開スタイルが適用されること", () => {
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={["album-2"]}
      />,
    );

    expect(getRowByName("夏休み")).not.toHaveClass("border-primary");
    expect(getRowByName("旅行")).toHaveClass("border-primary");
    expect(getRowByName("家族")).not.toHaveClass("border-primary");
  });

  it("expandedAlbumIdsが空配列のとき、どのAlbumにも展開スタイルが適用されないこと", () => {
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={[]}
      />,
    );

    expect(getRowByName("夏休み")).not.toHaveClass("border-primary");
    expect(getRowByName("旅行")).not.toHaveClass("border-primary");
    expect(getRowByName("家族")).not.toHaveClass("border-primary");
  });

  it("expandedAlbumIdsに複数のIDが含まれるとき、該当する複数のAlbumに展開スタイルが適用されること", () => {
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={["album-1", "album-3"]}
      />,
    );

    expect(getRowByName("夏休み")).toHaveClass("border-primary");
    expect(getRowByName("旅行")).not.toHaveClass("border-primary");
    expect(getRowByName("家族")).toHaveClass("border-primary");
  });

  it("いずれかのAlbumを選択すると、対応するalbumオブジェクトでonToggleExpandが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={[]}
      />,
    );

    await user.click(screen.getByText("旅行"));

    expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
    expect(mockOnToggleExpand).toHaveBeenCalledWith(mockAlbums[1]);
  });

  it("いずれかのAlbumの編集ボタンをクリックすると、対応するalbumオブジェクトでonEditが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "家族を編集" }));

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).toHaveBeenCalledWith(mockAlbums[2]);
  });

  it("いずれかのAlbumの削除ボタンをクリックすると、対応するalbumオブジェクトでonDeleteが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "夏休みを削除" }));

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockAlbums[0]);
  });

  it("disabledがtrueのとき、全Albumの編集・削除ボタンがdisabledになること", () => {
    render(
      <AlbumList
        albums={mockAlbums}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleExpand={mockOnToggleExpand}
        expandedAlbumIds={[]}
        disabled={true}
      />,
    );

    expect(screen.getByRole("button", { name: "夏休みを編集" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "旅行を編集" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "家族を編集" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "夏休みを削除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "旅行を削除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "家族を削除" })).toBeDisabled();
  });
});