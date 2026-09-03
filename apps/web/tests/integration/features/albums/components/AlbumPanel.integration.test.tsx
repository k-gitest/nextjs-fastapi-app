import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { AlbumPanel } from "@/features/albums/components/AlbumPanel";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { useCreateAlbum } from "@/features/albums/hooks/useCreateAlbum";
import { useUpdateAlbum } from "@/features/albums/hooks/useUpdateAlbum";
import { useDeleteAlbum } from "@/features/albums/hooks/useDeleteAlbum";
import type { Album } from "@/features/albums/types";

// AlbumDetailContainer・LibraryImageUploader・UnassignedImageContainerは
// このテストの対象外（前者は別ファイルで配線を検証済み、後2つは
// 画像機能でありAlbum管理の関心事ではない）。AlbumPanel自身のロジック
// （selectedAlbumIdの管理・wasSelectedの巻き戻し）に焦点を絞るため、
// 軽量なスタブに差し替える。
vi.mock("@/features/albums/components/AlbumDetailContainer", () => ({
  AlbumDetailContainer: ({ albumId }: { albumId: string }) => (
    <div data-testid="album-detail-container">{albumId}</div>
  ),
}));
vi.mock("@/features/images/components/LibraryImageUploader", () => ({
  LibraryImageUploader: () => <div data-testid="library-image-uploader" />,
}));
vi.mock("@/features/images/components/UnassignedImageContainer", () => ({
  UnassignedImageContainer: () => (
    <div data-testid="unassigned-image-container" />
  ),
}));

vi.mock("@/features/albums/hooks/useAlbums");
vi.mock("@/features/albums/hooks/useCreateAlbum");
vi.mock("@/features/albums/hooks/useUpdateAlbum");
vi.mock("@/features/albums/hooks/useDeleteAlbum");

describe("AlbumPanel", () => {
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

  const mockCreateMutateAsync = vi.fn();
  const mockUpdateMutateAsync = vi.fn();
  const mockDeleteMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useAlbums as Mock).mockReturnValue({ albums: mockAlbums });
    (useCreateAlbum as Mock).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    });
    (useUpdateAlbum as Mock).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    });
    (useDeleteAlbum as Mock).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });

    // デフォルトでは何もコールバックを呼ばない（各テストで必要に応じて上書きする）
    mockDeleteMutate.mockImplementation(() => {});
  });

  it("見出しとAlbum一覧が表示されること", () => {
    render(<AlbumPanel />);

    expect(screen.getByText("夏休み")).toBeInTheDocument();
    expect(screen.getByText("旅行")).toBeInTheDocument();
  });

  it("初期状態ではAlbumDetailContainerが表示されないこと", () => {
    render(<AlbumPanel />);
    expect(
      screen.queryByTestId("album-detail-container"),
    ).not.toBeInTheDocument();
  });

  it("Albumを選択すると、そのalbumIdでAlbumDetailContainerが表示されること", async () => {
    const user = userEvent.setup();
    render(<AlbumPanel />);

    await user.click(screen.getByText("夏休み"));

    expect(screen.getByTestId("album-detail-container")).toHaveTextContent(
      "album-1",
    );
  });

  it("Albumを展開すると、そのalbumIdでAlbumDetailContainerが表示されること", async () => {
    const user = userEvent.setup();
    render(<AlbumPanel />);

    await user.click(screen.getByText("夏休み"));

    expect(screen.getByTestId("album-detail-container")).toHaveTextContent(
      "album-1",
    );
  });

  it("別のAlbumも展開すると、両方のAlbumDetailContainerが同時に表示されること（複数同時展開）", async () => {
    const user = userEvent.setup();
    render(<AlbumPanel />);

    await user.click(screen.getByText("夏休み"));
    await user.click(screen.getByText("旅行"));

    const containers = screen.getAllByTestId("album-detail-container");
    expect(containers).toHaveLength(2);
    expect(containers.map((el) => el.textContent)).toEqual(
      expect.arrayContaining(["album-1", "album-2"]),
    );
  });

  it("展開中のAlbumを再クリックすると、そのAlbumDetailContainerのみ非表示になること", async () => {
    const user = userEvent.setup();
    render(<AlbumPanel />);

    await user.click(screen.getByText("夏休み"));
    await user.click(screen.getByText("旅行"));
    expect(screen.getAllByTestId("album-detail-container")).toHaveLength(2);

    await user.click(screen.getByText("夏休み"));

    const remaining = screen.getAllByTestId("album-detail-container");
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveTextContent("album-2");
  });

  it("新規アルバム作成: 入力して送信するとcreateMutation.mutateAsyncへ値が渡り、ダイアログが閉じること", async () => {
    const user = userEvent.setup();
    mockCreateMutateAsync.mockResolvedValue({ id: "album-3", name: "冬休み" });
    render(<AlbumPanel />);

    await user.click(screen.getByRole("button", { name: /新規アルバム/ }));
    await user.type(screen.getByLabelText("アルバム名"), "冬休み");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({ name: "冬休み" });
    });
    await waitFor(() => {
      expect(
        screen.queryByText("新しいアルバムを作成"),
      ).not.toBeInTheDocument();
    });
  });

  it("Album編集: 編集ボタンから入力して保存すると、updateMutation.mutateAsyncへ{id, name}が渡ること", async () => {
    const user = userEvent.setup();
    mockUpdateMutateAsync.mockResolvedValue({ id: "album-1", name: "春休み" });
    render(<AlbumPanel />);

    await user.click(screen.getByRole("button", { name: "夏休みを編集" }));
    expect(screen.getByText("アルバム名を変更")).toBeInTheDocument();

    const input = screen.getByLabelText("アルバム名");
    await user.clear(input);
    await user.type(input, "春休み");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "album-1",
        name: "春休み",
      });
    });
  });

  it("削除ボタンから確認ダイアログが開き、「削除する」でdeleteMutation.mutateが対象idで呼ばれること", async () => {
    const user = userEvent.setup();
    render(<AlbumPanel />);

    await user.click(screen.getByRole("button", { name: "夏休みを削除" }));
    expect(screen.getByText("アルバムを削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate).toHaveBeenCalledWith(
      "album-1",
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("選択中のAlbumを削除確定すると、Mutation結果を待たずに即座にAlbumDetailContainerが非表示になること（先読み選択解除）", async () => {
    const user = userEvent.setup();
    // このテストではonSuccess/onErrorどちらも呼ばない（Mutationが未解決のまま、の状態を再現）
    mockDeleteMutate.mockImplementation(() => {});
    render(<AlbumPanel />);

    await user.click(screen.getByText("夏休み"));
    expect(screen.getByTestId("album-detail-container")).toHaveTextContent(
      "album-1",
    );

    await user.click(screen.getByRole("button", { name: "夏休みを削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    // mutateの結果コールバックはまだ呼ばれていないが、選択解除はmutate呼び出し前に
    // 同期的に行われるため、この時点でAlbumDetailContainerは消えている
    expect(
      screen.queryByTestId("album-detail-container"),
    ).not.toBeInTheDocument();
  });

  it("選択中のAlbumの削除に失敗すると、選択状態が復元されAlbumDetailContainerが再表示されること", async () => {
    const user = userEvent.setup();
    mockDeleteMutate.mockImplementation((_id, options) => {
      options?.onError?.();
    });
    render(<AlbumPanel />);

    await user.click(screen.getByText("夏休み"));
    await user.click(screen.getByRole("button", { name: "夏休みを削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(screen.getByTestId("album-detail-container")).toHaveTextContent(
        "album-1",
      );
    });
  });

  it("選択中のAlbumの削除に成功すると、選択状態は復元されず（解除されたまま）、削除確認ダイアログが閉じること", async () => {
    const user = userEvent.setup();
    mockDeleteMutate.mockImplementation((_id, options) => {
      options?.onSuccess?.();
    });
    render(<AlbumPanel />);

    await user.click(screen.getByText("夏休み"));
    await user.click(screen.getByRole("button", { name: "夏休みを削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(
        screen.queryByText("アルバムを削除しますか？"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("album-detail-container"),
    ).not.toBeInTheDocument();
  });

  it("選択されていないAlbumの削除に失敗しても、他Albumの選択状態は変化しないこと", async () => {
    const user = userEvent.setup();
    mockDeleteMutate.mockImplementation((_id, options) => {
      options?.onError?.();
    });
    render(<AlbumPanel />);

    // album-1（夏休み）を選択中の状態にする
    await user.click(screen.getByText("夏休み"));
    expect(screen.getByTestId("album-detail-container")).toHaveTextContent(
      "album-1",
    );

    // 選択中ではないalbum-2（旅行）を削除して失敗させる
    await user.click(screen.getByRole("button", { name: "旅行を削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    // album-1の選択状態は変化しない
    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledWith(
        "album-2",
        expect.anything(),
      );
    });
    expect(screen.getByTestId("album-detail-container")).toHaveTextContent(
      "album-1",
    );
  });

  it("キャンセルをクリックすると、deleteMutation.mutateは呼ばれずダイアログが閉じること", async () => {
    const user = userEvent.setup();
    render(<AlbumPanel />);

    await user.click(screen.getByRole("button", { name: "夏休みを削除" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mockDeleteMutate).not.toHaveBeenCalled();
    expect(
      screen.queryByText("アルバムを削除しますか？"),
    ).not.toBeInTheDocument();
  });

  it("いずれかのMutationがisPending中のとき、AlbumListの編集・削除ボタンがdisabledになること", () => {
    (useDeleteAlbum as Mock).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: true,
    });
    render(<AlbumPanel />);

    expect(screen.getByRole("button", { name: "夏休みを編集" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "夏休みを削除" })).toBeDisabled();
  });

  it("未所属の画像セクション（モック済み子コンポーネント）が表示されること", () => {
    render(<AlbumPanel />);

    expect(screen.getByText("未所属の画像")).toBeInTheDocument();
    expect(screen.getByTestId("library-image-uploader")).toBeInTheDocument();
    expect(
      screen.getByTestId("unassigned-image-container"),
    ).toBeInTheDocument();
  });
});
