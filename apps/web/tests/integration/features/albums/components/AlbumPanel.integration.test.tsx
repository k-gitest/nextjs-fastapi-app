import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { AlbumPanel } from "@/features/albums/components/AlbumPanel";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { useCreateAlbum } from "@/features/albums/hooks/useCreateAlbum";
import { useUpdateAlbum } from "@/features/albums/hooks/useUpdateAlbum";
import { useDeleteAlbum } from "@/features/albums/hooks/useDeleteAlbum";
import { useReorderAlbumImages } from "@/features/albums/hooks/useReorderAlbumImages";
import type { Album, AlbumDetail } from "@/features/albums/types";
import { useUnassignedImages } from "@/features/images/hooks/useUnassignedImages";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import type { ImageSummary } from "@/features/images/types";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

// AlbumDetailContainer・LibraryImageUploader・UnassignedImageContainerは
// このテストの対象外（前者は別ファイルで配線を検証済み、後2つは
// 画像機能でありAlbum管理の関心事ではない）。AlbumPanel自身のロジック
// （expandedAlbumIdsの管理・DnD分岐・excludeImageId/pendingAlbumRemovalの
// 受け渡し）に焦点を絞るため、軽量なスタブに差し替える。
//
// AlbumDetailContainerへ渡るpropはexcludeImageId（文字列）ではなく
// excludeSignal（{albumId, imageId}オブジェクト）に変更されている
// （同一画像の往復移動時に値だけでは変化が検知できない問題への対応、
// AlbumList/AlbumItem/AlbumDetailContainer側の変更参照）。テスト側の
// data属性名（data-exclude-image-id）は既存のアサーションを変更しないため
// そのまま維持し、excludeSignal.imageIdの値を表示する。
vi.mock("@/features/albums/components/AlbumDetailContainer", () => ({
  AlbumDetailContainer: ({
    albumId,
    excludeSignal,
  }: {
    albumId: string;
    excludeSignal?: { albumId: string; imageId: string };
  }) => (
    <div
      data-testid="album-detail-container"
      data-exclude-image-id={excludeSignal?.imageId ?? ""}
    >
      {albumId}
    </div>
  ),
}));
vi.mock("@/features/images/components/LibraryImageUploader", () => ({
  LibraryImageUploader: () => <div data-testid="library-image-uploader" />,
}));
vi.mock("@/features/images/components/UnassignedImageContainer", () => ({
  UnassignedImageContainer: ({
    excludeImageId,
  }: {
    excludeImageId?: string | null;
  }) => (
    <div
      data-testid="unassigned-image-container"
      data-exclude-image-id={excludeImageId ?? ""}
    />
  ),
}));

vi.mock("@/features/albums/hooks/useAlbums");
vi.mock("@/features/albums/hooks/useCreateAlbum");
vi.mock("@/features/albums/hooks/useUpdateAlbum");
vi.mock("@/features/albums/hooks/useDeleteAlbum");
vi.mock("@/features/albums/hooks/useReorderAlbumImages");
vi.mock("@/features/images/hooks/useUnassignedImages");
vi.mock("@/features/images/hooks/useUpdateImageAlbum");

// DndContextをモックし、onDragStart/onDragEndを外部からキャプチャして直接呼び出せる
// ようにする。実際のPointerEventシーケンスは再現せず、「Containerの配線」のみを
// 検証する。
let capturedOnDragStart: ((event: DragStartEvent) => void) | undefined;
let capturedOnDragEnd: ((event: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragEnd,
    }: {
      children: React.ReactNode;
      onDragStart?: (event: DragStartEvent) => void;
      onDragEnd?: (event: DragEndEvent) => void;
    }) => {
      capturedOnDragStart = onDragStart;
      capturedOnDragEnd = onDragEnd;
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
  };
});

// useQueryClient().getQueryData()をモックし、AlbumDetailキャッシュの内容を
// テストごとに差し替え可能にする。実際のQueryClientProviderは使わない
// （既存のvi.mock構成に合わせ、hookレベルは全てモック済みのため）。
const mockGetQueryData = vi.fn();
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      getQueryData: mockGetQueryData,
    }),
  };
});

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

  const mockUnassignedImages: ImageSummary[] = [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
    },
  ];

  const mockAlbum1Detail: AlbumDetail = {
    id: "album-1",
    name: "夏休み",
    images: [
      {
        id: "img-a",
        originalFileName: "a.png",
        mimeType: "image/png",
        fileSize: 100,
        createdAt: new Date("2026-06-01"),
        usageCount: 0,
        albumDisplayOrder: 0,
      },
      {
        id: "img-b",
        originalFileName: "b.png",
        mimeType: "image/png",
        fileSize: 200,
        createdAt: new Date("2026-06-02"),
        usageCount: 0,
        albumDisplayOrder: 1,
      },
    ],
  } as AlbumDetail;

  const mockCreateMutateAsync = vi.fn();
  const mockUpdateMutateAsync = vi.fn();
  const mockDeleteMutate = vi.fn();
  const mockMoveToAlbumMutate = vi.fn();
  const mockReorderMutate = vi.fn();

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
    (useUnassignedImages as Mock).mockReturnValue({
      images: mockUnassignedImages,
    });
    (useUpdateImageAlbum as Mock).mockReturnValue({
      mutate: mockMoveToAlbumMutate,
      isPending: false,
    });
    (useReorderAlbumImages as Mock).mockReturnValue({
      mutate: mockReorderMutate,
      isPending: false,
    });

    // vi.clearAllMocks()は呼び出し履歴のみをクリアし、mockImplementationで
    // 設定した実装自体はクリアしない。特定のテストでonErrorを即座に呼ぶ実装を
    // 設定すると、以降のテストに漏れて誤動作の原因になるため、
    // 各mutateを明示的にno-op実装へ戻す（mockDeleteMutateと同じ対策）。
    mockDeleteMutate.mockImplementation(() => {});
    mockMoveToAlbumMutate.mockImplementation(() => {});
    mockGetQueryData.mockImplementation(() => undefined);

    capturedOnDragStart = undefined;
    capturedOnDragEnd = undefined;
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

  describe("未所属画像→Albumへのドラッグ&ドロップ", () => {
    it("unassigned-image → album のDragEndでupdateImageAlbumが正しい引数で呼ばれること", () => {
      render(<AlbumPanel />);
      expect(capturedOnDragEnd).toBeDefined();

      capturedOnDragEnd?.({
        active: {
          id: "image-img-1",
          data: { current: { type: "unassigned-image", imageId: "img-1" } },
        },
        over: {
          id: "album-album-1",
          data: { current: { type: "album", albumId: "album-1" } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).toHaveBeenCalledWith(
        { imageId: "img-1", albumId: "album-1" },
        expect.objectContaining({
          onError: expect.any(Function),
          onSettled: expect.any(Function),
        }),
      );
    });

    it("overが存在しない（ドロップ先が無効）場合はMutationを呼ばないこと", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "image-img-1",
          data: { current: { type: "unassigned-image", imageId: "img-1" } },
        },
        over: null,
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).not.toHaveBeenCalled();
    });

    it("overのtypeがalbumでない場合はMutationを呼ばないこと", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "image-img-1",
          data: { current: { type: "unassigned-image", imageId: "img-1" } },
        },
        over: {
          id: "something-else",
          data: { current: { type: "not-an-album" } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).not.toHaveBeenCalled();
    });

    it("imageIdまたはalbumIdが取得できない（string以外）場合はMutationを呼ばないこと", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "image-img-1",
          data: { current: { type: "unassigned-image", imageId: undefined } },
        },
        over: {
          id: "album-album-1",
          data: { current: { type: "album", albumId: "album-1" } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).not.toHaveBeenCalled();
    });

    it("DragStart時、draggingImageIdがセットされDragOverlayにImageDragPreviewが表示されること", () => {
      render(<AlbumPanel />);
      expect(capturedOnDragStart).toBeDefined();

      act(() => {
        capturedOnDragStart?.({
          active: {
            id: "image-img-1",
            data: { current: { type: "unassigned-image", imageId: "img-1" } },
          },
        } as unknown as DragStartEvent);
      });

      expect(screen.getByAltText("photo1.png")).toBeInTheDocument();
    });

    it("DragEnd直後、UnassignedImageContainerにexcludeImageIdとしてドロップした画像IDが渡ること", () => {
      render(<AlbumPanel />);

      act(() => {
        capturedOnDragEnd?.({
          active: {
            id: "image-img-1",
            data: { current: { type: "unassigned-image", imageId: "img-1" } },
          },
          over: {
            id: "album-album-1",
            data: { current: { type: "album", albumId: "album-1" } },
          },
        } as unknown as DragEndEvent);
      });

      expect(screen.getByTestId("unassigned-image-container")).toHaveAttribute(
        "data-exclude-image-id",
        "img-1",
      );
    });

    it("unassignedImagesの再取得結果に対象画像が含まれなくなると、excludeImageIdが解除されること", () => {
      const { rerender } = render(<AlbumPanel />);

      act(() => {
        capturedOnDragEnd?.({
          active: {
            id: "image-img-1",
            data: { current: { type: "unassigned-image", imageId: "img-1" } },
          },
          over: {
            id: "album-album-1",
            data: { current: { type: "album", albumId: "album-1" } },
          },
        } as unknown as DragEndEvent);
      });

      (useUnassignedImages as Mock).mockReturnValue({ images: [] });
      rerender(<AlbumPanel />);

      expect(screen.getByTestId("unassigned-image-container")).toHaveAttribute(
        "data-exclude-image-id",
        "",
      );
    });

    it("MutationがonErrorを呼んだ場合、unassignedImagesが変化していなくても即座にexcludeImageIdが解除されること", () => {
      mockMoveToAlbumMutate.mockImplementation((_variables, options) => {
        options?.onError?.();
      });
      render(<AlbumPanel />);

      act(() => {
        capturedOnDragEnd?.({
          active: {
            id: "image-img-1",
            data: { current: { type: "unassigned-image", imageId: "img-1" } },
          },
          over: {
            id: "album-album-1",
            data: { current: { type: "album", albumId: "album-1" } },
          },
        } as unknown as DragEndEvent);
      });

      expect(screen.getByTestId("unassigned-image-container")).toHaveAttribute(
        "data-exclude-image-id",
        "",
      );
    });
  });

  describe("Album内画像 → 同一Album内reorder", () => {
    it("Album内画像同士のDragEndで、キャッシュのimages順序をarrayMoveした結果がreorderMutationへ渡ること", () => {
      mockGetQueryData.mockImplementation(() => mockAlbum1Detail);
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "img-b",
          data: {
            current: {
              type: "album-image",
              imageId: "img-b",
              sourceAlbumId: "album-1",
            },
          },
        },
      } as unknown as DragEndEvent);

      expect(mockReorderMutate).toHaveBeenCalledWith({
        albumId: "album-1",
        imageIds: ["img-b", "img-a"],
      });
    });

    it("自分自身へのドロップ（同一imageId）ではreorderMutationを呼ばないこと", () => {
      mockGetQueryData.mockImplementation(() => mockAlbum1Detail);
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
      } as unknown as DragEndEvent);

      expect(mockReorderMutate).not.toHaveBeenCalled();
    });

    it("移動先Albumの展開領域（album型）自体へのドロップではreorderMutationを呼ばないこと（位置を特定できないためno-op）", () => {
      mockGetQueryData.mockImplementation(() => mockAlbum1Detail);
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "album-album-1",
          data: { current: { type: "album", albumId: "album-1" } },
        },
      } as unknown as DragEndEvent);

      expect(mockReorderMutate).not.toHaveBeenCalled();
      expect(mockMoveToAlbumMutate).not.toHaveBeenCalled();
    });

    it("対象Albumのキャッシュが取得できない場合はreorderMutationを呼ばないこと", () => {
      mockGetQueryData.mockImplementation(() => undefined);
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "img-b",
          data: {
            current: {
              type: "album-image",
              imageId: "img-b",
              sourceAlbumId: "album-1",
            },
          },
        },
      } as unknown as DragEndEvent);

      expect(mockReorderMutate).not.toHaveBeenCalled();
    });
  });

  describe("Album内画像 → 別Albumへの移動", () => {
    it("別Albumの画像カード上（album-image）へのドロップでupdateImageAlbumが呼ばれること", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "img-c",
          data: {
            current: {
              type: "album-image",
              imageId: "img-c",
              sourceAlbumId: "album-2",
            },
          },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).toHaveBeenCalledWith(
        { imageId: "img-a", albumId: "album-2" },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
      expect(mockReorderMutate).not.toHaveBeenCalled();
    });

    it("別Albumの行/展開領域自体（album型）へのドロップでもupdateImageAlbumが呼ばれること（畳んだAlbumへのドロップを許容する）", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "album-album-2",
          data: { current: { type: "album", albumId: "album-2" } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).toHaveBeenCalledWith(
        { imageId: "img-a", albumId: "album-2" },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it("移動確定直後、AlbumListへ渡るpendingRemoval（albumId/imageId）が移動元Albumとその画像を指すこと", async () => {
      const user = userEvent.setup();
      render(<AlbumPanel />);

      // 移動元Album（album-1）を事前に展開しておく
      await user.click(screen.getByText("夏休み"));

      act(() => {
        capturedOnDragEnd?.({
          active: {
            id: "img-a",
            data: {
              current: {
                type: "album-image",
                imageId: "img-a",
                sourceAlbumId: "album-1",
              },
            },
          },
          over: {
            id: "album-album-2",
            data: { current: { type: "album", albumId: "album-2" } },
          },
        } as unknown as DragEndEvent);
      });

      const containers = screen.getAllByTestId("album-detail-container");
      const album1Container = containers.find(
        (el) => el.textContent === "album-1",
      );
      expect(album1Container).toHaveAttribute(
        "data-exclude-image-id",
        "img-a",
      );
    });

    it("Mutationが失敗（onError）した場合、pendingRemovalが即座に解除されること", async () => {
      const user = userEvent.setup();
      mockMoveToAlbumMutate.mockImplementation((_variables, options) => {
        options?.onError?.();
      });
      render(<AlbumPanel />);

      await user.click(screen.getByText("夏休み"));

      act(() => {
        capturedOnDragEnd?.({
          active: {
            id: "img-a",
            data: {
              current: {
                type: "album-image",
                imageId: "img-a",
                sourceAlbumId: "album-1",
              },
            },
          },
          over: {
            id: "album-album-2",
            data: { current: { type: "album", albumId: "album-2" } },
          },
        } as unknown as DragEndEvent);
      });

      const containers = screen.getAllByTestId("album-detail-container");
      const album1Container = containers.find(
        (el) => el.textContent === "album-1",
      );
      expect(album1Container).toHaveAttribute("data-exclude-image-id", "");
    });

    it("targetAlbumIdが取得できない（string以外）場合はMutationを呼ばないこと", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "album-x",
          data: { current: { type: "album", albumId: undefined } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).not.toHaveBeenCalled();
    });

    it("sourceAlbumIdが取得できない場合はMutationを呼ばないこと", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: { type: "album-image", imageId: "img-a" },
          },
        },
        over: {
          id: "album-album-2",
          data: { current: { type: "album", albumId: "album-2" } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).not.toHaveBeenCalled();
    });
  });

  describe("Album内画像 → 未所属への移動", () => {
    it("unassignedのdroppableへのドロップでupdateImageAlbumがalbumId=nullで呼ばれること", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: {
              type: "album-image",
              imageId: "img-a",
              sourceAlbumId: "album-1",
            },
          },
        },
        over: {
          id: "unassigned-drop-zone",
          data: { current: { type: "unassigned" } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).toHaveBeenCalledWith(
        { imageId: "img-a", albumId: null },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
      expect(mockReorderMutate).not.toHaveBeenCalled();
    });

    it("移動確定直後、AlbumListへ渡るpendingRemovalが移動元Albumとその画像を指すこと", async () => {
      const user = userEvent.setup();
      render(<AlbumPanel />);

      await user.click(screen.getByText("夏休み"));

      act(() => {
        capturedOnDragEnd?.({
          active: {
            id: "img-a",
            data: {
              current: {
                type: "album-image",
                imageId: "img-a",
                sourceAlbumId: "album-1",
              },
            },
          },
          over: {
            id: "unassigned-drop-zone",
            data: { current: { type: "unassigned" } },
          },
        } as unknown as DragEndEvent);
      });

      const containers = screen.getAllByTestId("album-detail-container");
      const album1Container = containers.find(
        (el) => el.textContent === "album-1",
      );
      expect(album1Container).toHaveAttribute(
        "data-exclude-image-id",
        "img-a",
      );
    });

    it("Mutationが失敗（onError）した場合、pendingRemovalが即座に解除されること", async () => {
      const user = userEvent.setup();
      mockMoveToAlbumMutate.mockImplementation((_variables, options) => {
        options?.onError?.();
      });
      render(<AlbumPanel />);

      await user.click(screen.getByText("夏休み"));

      act(() => {
        capturedOnDragEnd?.({
          active: {
            id: "img-a",
            data: {
              current: {
                type: "album-image",
                imageId: "img-a",
                sourceAlbumId: "album-1",
              },
            },
          },
          over: {
            id: "unassigned-drop-zone",
            data: { current: { type: "unassigned" } },
          },
        } as unknown as DragEndEvent);
      });

      const containers = screen.getAllByTestId("album-detail-container");
      const album1Container = containers.find(
        (el) => el.textContent === "album-1",
      );
      expect(album1Container).toHaveAttribute("data-exclude-image-id", "");
    });

    it("sourceAlbumIdが取得できない場合はMutationを呼ばないこと", () => {
      render(<AlbumPanel />);

      capturedOnDragEnd?.({
        active: {
          id: "img-a",
          data: {
            current: { type: "album-image", imageId: "img-a" },
          },
        },
        over: {
          id: "unassigned-drop-zone",
          data: { current: { type: "unassigned" } },
        },
      } as unknown as DragEndEvent);

      expect(mockMoveToAlbumMutate).not.toHaveBeenCalled();
    });
  });

  describe("Album内画像のDragStart（プレビュー）", () => {
    it("展開中Albumの画像をDragStartすると、キャッシュから見つけた画像でImageDragPreviewが表示されること", async () => {
      const user = userEvent.setup();
      mockGetQueryData.mockImplementation(() => mockAlbum1Detail);
      render(<AlbumPanel />);

      // album-1を展開状態にする（expandedAlbumIdsに含めるため）
      await user.click(screen.getByText("夏休み"));

      act(() => {
        capturedOnDragStart?.({
          active: {
            id: "img-a",
            data: {
              current: {
                type: "album-image",
                imageId: "img-a",
                sourceAlbumId: "album-1",
              },
            },
          },
        } as unknown as DragStartEvent);
      });

      expect(screen.getByAltText("a.png")).toBeInTheDocument();
    });
  });
});