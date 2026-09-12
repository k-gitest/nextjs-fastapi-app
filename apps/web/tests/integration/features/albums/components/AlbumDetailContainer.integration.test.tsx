import { render, screen, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { AlbumDetailContainer } from "@/features/albums/components/AlbumDetailContainer";
import { useAlbumDetail } from "@/features/albums/hooks/useAlbumDetail";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { useDeleteImage } from "@/features/albums/hooks/useDeleteImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import type {
  AlbumDetail,
  Album,
  AlbumImageItem,
} from "@/features/albums/types";

// AlbumImageGrid自体のUI・移動UI・DnDの挙動はAlbumImageGrid.test.tsxで実物レンダリングして
// 検証済みのため、ここではモックに差し替え、Containerが正しいpropsを渡しているかのみを
// 検証する（責務の重複を避ける）。
//
// onReorder / useReorderAlbumImagesはAlbumDetailContainerの責務ではなくなった
// （reorderの発火点がAlbumPanelへ一本化されたため、このコンポーネントは
// reorder関連の配線を一切持たない）。
type CapturedAlbumImageGridProps = {
  albumId: string;
  images: AlbumImageItem[];
  otherAlbums: Album[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  onMove: (imageId: string, albumId: string | null) => void;
  deleting?: boolean;
  moving?: boolean;
};

const { mockAlbumImageGridImpl } = vi.hoisted(() => ({
  mockAlbumImageGridImpl: vi.fn(),
}));
mockAlbumImageGridImpl.mockImplementation(() => null);

vi.mock("@/features/albums/components/AlbumImageGrid", () => ({
  AlbumImageGrid: (props: CapturedAlbumImageGridProps) =>
    mockAlbumImageGridImpl(props),
}));

vi.mock("@/features/albums/hooks/useAlbumDetail");
vi.mock("@/features/albums/hooks/useAlbums");
vi.mock("@/features/albums/hooks/useDeleteImage");
vi.mock("@/features/images/hooks/useUpdateImageAlbum");

describe("AlbumDetailContainer", () => {
  const mockAlbumImages: AlbumImageItem[] = [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
      albumDisplayOrder: 0,
    },
  ];

  const mockAlbumDetail: AlbumDetail = {
    id: "album-1",
    name: "夏休み",
    userId: "user-1",
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
    images: mockAlbumImages,
  } as AlbumDetail;

  // useAlbumsは全Albumを返す（現在表示中のalbum-1自身も含む）。
  // otherAlbumsからalbum-1を除外するのはAlbumDetailContainerの責務のため、
  // あえて album-1 を含んだ状態でモックし、除外ロジックが実際に機能するかを検証する。
  const mockAlbumsList: Album[] = [
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

  const mockDeleteMutate = vi.fn();
  const mockMoveMutate = vi.fn();

  const getLastGridProps = (): CapturedAlbumImageGridProps => {
    const calls = mockAlbumImageGridImpl.mock.calls;
    return calls[calls.length - 1][0] as CapturedAlbumImageGridProps;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useAlbumDetail as Mock).mockReturnValue({ album: mockAlbumDetail });
    (useAlbums as Mock).mockReturnValue({ albums: mockAlbumsList });
    (useDeleteImage as Mock).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });
    (useUpdateImageAlbum as Mock).mockReturnValue({
      mutate: mockMoveMutate,
      isPending: false,
    });
  });

  it("Album名を含む見出しが表示されること", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    expect(screen.getByText("夏休みの画像")).toBeInTheDocument();
  });

  it("useAlbumDetailで取得したimagesがそのままAlbumImageGridへ渡されること", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();
    expect(props.images.map((img) => img.id)).toEqual(
      mockAlbumImages.map((img) => img.id),
    );
  });

  it("albumIdがAlbumImageGridへそのまま渡されること", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();
    expect(props.albumId).toBe("album-1");
  });

  it("otherAlbumsから現在表示中のAlbum自身（album-1）が除外されること", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();
    expect(props.otherAlbums.map((a) => a.id)).toEqual(["album-2", "album-3"]);
  });

  it("onDeleteが呼ばれると、deleteMutation.mutateへ{albumId, imageId}とonSuccessコールバックが渡されること", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();
    const onSuccessCallback = vi.fn();

    props.onDelete("img-1", onSuccessCallback);

    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate).toHaveBeenCalledWith(
      { albumId: "album-1", imageId: "img-1" },
      { onSuccess: onSuccessCallback },
    );
  });

  it("onMoveが呼ばれると、moveMutation.mutateへ{imageId, albumId}とonErrorコールバックが渡されること（Album指定時）", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();

    act(() => {
      props.onMove("img-1", "album-2");
    });

    expect(mockMoveMutate).toHaveBeenCalledTimes(1);
    expect(mockMoveMutate).toHaveBeenCalledWith(
      { imageId: "img-1", albumId: "album-2" },
      { onError: expect.any(Function) },
    );
  });

  it("onMoveがalbumId=nullで呼ばれると、moveMutation.mutateへもalbumId=nullがそのまま渡されること（未所属へ戻す）", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();

    act(() => {
      props.onMove("img-1", null);
    });

    expect(mockMoveMutate).toHaveBeenCalledTimes(1);
    expect(mockMoveMutate).toHaveBeenCalledWith(
      { imageId: "img-1", albumId: null },
      { onError: expect.any(Function) },
    );
  });

  it("deleteMutation.isPendingがtrueのとき、AlbumImageGridへdeleting=trueが渡されること", () => {
    (useDeleteImage as Mock).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: true,
    });

    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();

    expect(props.deleting).toBe(true);
  });

  it("moveMutation.isPendingがtrueのとき、AlbumImageGridへmoving=trueが渡されること", () => {
    (useUpdateImageAlbum as Mock).mockReturnValue({
      mutate: mockMoveMutate,
      isPending: true,
    });

    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();

    expect(props.moving).toBe(true);
  });

  describe("Select経由のAlbum移動中のpending表示制御", () => {
    it("onMoveが呼ばれた直後、対象画像がAlbumImageGridへ渡るimagesから除外されること", () => {
      render(<AlbumDetailContainer albumId="album-1" />);

      act(() => {
        getLastGridProps().onMove("img-1", "album-2");
      });

      const props = getLastGridProps();
      expect(props.images.map((img) => img.id)).not.toContain("img-1");
    });

    it("移動対象でない画像には影響しないこと（該当画像のみ除外される）", () => {
      const multiImages: AlbumImageItem[] = [
        ...mockAlbumImages,
        {
          id: "img-2",
          originalFileName: "photo2.png",
          mimeType: "image/png",
          fileSize: 2000,
          createdAt: new Date("2026-06-02"),
          usageCount: 0,
          albumDisplayOrder: 1,
        },
      ];
      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: multiImages },
      });

      render(<AlbumDetailContainer albumId="album-1" />);

      act(() => {
        getLastGridProps().onMove("img-1", "album-2");
      });

      const props = getLastGridProps();
      expect(props.images.map((img) => img.id)).toEqual(["img-2"]);
    });

    it("album.imagesから対象画像が消えると、pendingが解除され最新の一覧が表示されること", () => {
      const { rerender } = render(<AlbumDetailContainer albumId="album-1" />);

      act(() => {
        getLastGridProps().onMove("img-1", "album-2");
      });

      // Query更新によりalbum.imagesからimg-1が消えた状態を再現
      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: [] },
      });
      act(() => {
        rerender(<AlbumDetailContainer albumId="album-1" />);
      });

      const props = getLastGridProps();
      expect(props.images.map((img) => img.id)).toEqual([]);
    });

    it("moveMutation.mutateのonErrorが呼ばれると、pendingが解除され元の画像が再表示されること", () => {
      render(<AlbumDetailContainer albumId="album-1" />);
      getLastGridProps().onMove("img-1", "album-2");

      const options = mockMoveMutate.mock.calls[0][1] as {
        onError: () => void;
      };
      act(() => {
        options.onError();
      });

      const props = getLastGridProps();
      expect(props.images.map((img) => img.id)).toEqual(["img-1"]);
    });
  });

  describe("AlbumPanel（DnD）由来のexcludeSignal", () => {
    // excludeSignalはprevExcludeSignalとの参照比較によってprop変化を検知した
    // 時点で初めてローカルへ取り込まれる設計のため、フレッシュmount時点で
    // 最初からexcludeSignalが渡された状態は検証しない。フレッシュmount時に
    // 無条件で取り込むと、AlbumPanel側でpendingAlbumRemovalが解除されないまま
    // 残った古い値（stale）を再展開時に取り込んでしまい、実際にはAlbumへ
    // 戻っている画像を永久に非表示にしてしまう回帰を招くため。
    // そのため、いずれのテストもmount後のprop変化（rerender）を経由させる。
    //
    // excludeSignalはAlbumPanel側でsetPendingAlbumRemoval()のたびに新しく
    // 生成されるオブジェクトであり、値が同じでも参照が変わることで
    // 「新しい移動が発生した」ことを検知する設計（同一画像の往復移動対策）。
    // そのため「値は同じだが参照は別のオブジェクト」を渡すテストと、
    // 「同一オブジェクト参照をそのまま繰り返し渡す」テストを区別して書く。

    it("mount後にexcludeSignalが渡されると、対象画像がAlbumImageGridへ渡るimagesから除外されること", () => {
      const { rerender } = render(<AlbumDetailContainer albumId="album-1" />);
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-1",
      ]);

      act(() => {
        rerender(
          <AlbumDetailContainer
            albumId="album-1"
            excludeSignal={{ albumId: "album-1", imageId: "img-1" }}
          />,
        );
      });

      expect(getLastGridProps().images.map((img) => img.id)).not.toContain(
        "img-1",
      );
    });

    it("mount後にexcludeSignalが渡されても、対象外の画像には影響しないこと", () => {
      const multiImages: AlbumImageItem[] = [
        ...mockAlbumImages,
        {
          id: "img-2",
          originalFileName: "photo2.png",
          mimeType: "image/png",
          fileSize: 2000,
          createdAt: new Date("2026-06-02"),
          usageCount: 0,
          albumDisplayOrder: 1,
        },
      ];
      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: multiImages },
      });

      const { rerender } = render(<AlbumDetailContainer albumId="album-1" />);
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-1",
        "img-2",
      ]);

      act(() => {
        rerender(
          <AlbumDetailContainer
            albumId="album-1"
            excludeSignal={{ albumId: "album-1", imageId: "img-1" }}
          />,
        );
      });

      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-2",
      ]);
    });

    it("excludeSignalが指定された画像が実データ（album.images）から消えると、除外状態が解除され最新の一覧が表示されること（実データ駆動の解除）", () => {
      const signal = { albumId: "album-1", imageId: "img-1" };
      const { rerender } = render(<AlbumDetailContainer albumId="album-1" />);

      act(() => {
        rerender(
          <AlbumDetailContainer albumId="album-1" excludeSignal={signal} />,
        );
      });
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([]);

      // 同一参照のsignalを維持したまま、実データ側だけが変化する状況を再現
      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: [] },
      });
      act(() => {
        rerender(
          <AlbumDetailContainer albumId="album-1" excludeSignal={signal} />,
        );
      });

      expect(getLastGridProps().images.map((img) => img.id)).toEqual([]);

      const newImage: AlbumImageItem = {
        id: "img-9",
        originalFileName: "photo9.png",
        mimeType: "image/png",
        fileSize: 500,
        createdAt: new Date("2026-07-01"),
        usageCount: 0,
        albumDisplayOrder: 0,
      };
      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: [newImage] },
      });
      act(() => {
        rerender(
          <AlbumDetailContainer albumId="album-1" excludeSignal={signal} />,
        );
      });

      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-9",
      ]);
    });

    it("excludeSignalが値からundefinedへ変わった場合、対応するローカルの除外も解除されること（AlbumPanel側のonError復旧を反映）", () => {
      const multiImages: AlbumImageItem[] = [
        ...mockAlbumImages,
        {
          id: "img-2",
          originalFileName: "photo2.png",
          mimeType: "image/png",
          fileSize: 2000,
          createdAt: new Date("2026-06-02"),
          usageCount: 0,
          albumDisplayOrder: 1,
        },
      ];
      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: multiImages },
      });

      const { rerender } = render(<AlbumDetailContainer albumId="album-1" />);

      act(() => {
        rerender(
          <AlbumDetailContainer
            albumId="album-1"
            excludeSignal={{ albumId: "album-1", imageId: "img-1" }}
          />,
        );
      });
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-2",
      ]);

      act(() => {
        rerender(<AlbumDetailContainer albumId="album-1" />);
      });

      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-1",
        "img-2",
      ]);
    });

    it("同一のexcludeSignal参照が再レンダーで繰り返し渡されても、ローカルで解除済みの状態を上書きしないこと", () => {
      const signal = { albumId: "album-1", imageId: "img-1" };
      const { rerender } = render(<AlbumDetailContainer albumId="album-1" />);

      act(() => {
        rerender(
          <AlbumDetailContainer albumId="album-1" excludeSignal={signal} />,
        );
      });
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([]);

      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: [] },
      });
      act(() => {
        // 同一のsignal参照を再度渡す（値は同じ、参照も同じ）
        rerender(
          <AlbumDetailContainer albumId="album-1" excludeSignal={signal} />,
        );
      });
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([]);

      const newImage: AlbumImageItem = {
        id: "img-8",
        originalFileName: "photo8.png",
        mimeType: "image/png",
        fileSize: 700,
        createdAt: new Date("2026-07-02"),
        usageCount: 0,
        albumDisplayOrder: 0,
      };
      (useAlbumDetail as Mock).mockReturnValue({
        album: { ...mockAlbumDetail, images: [newImage] },
      });
      act(() => {
        // 同一のsignal参照を再度渡す
        rerender(
          <AlbumDetailContainer albumId="album-1" excludeSignal={signal} />,
        );
      });

      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-8",
      ]);
    });

    it("値は同じだが参照が異なるexcludeSignalが渡された場合、新しい移動として再度除外が適用されること（同一画像の往復移動対策）", () => {
      const { rerender } = render(<AlbumDetailContainer albumId="album-1" />);

      // 1回目: img-1をAlbum-1から除外
      act(() => {
        rerender(
          <AlbumDetailContainer
            albumId="album-1"
            excludeSignal={{ albumId: "album-1", imageId: "img-1" }}
          />,
        );
      });
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([]);

      // img-1がAlbum-1へ戻ってきた状態を再現（実データ駆動で除外が解除される）
      act(() => {
        rerender(<AlbumDetailContainer albumId="album-1" />);
      });
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([
        "img-1",
      ]);

      // 2回目: 値としては1回目と同じ{albumId: "album-1", imageId: "img-1"}だが、
      // AlbumPanel側の実装ではsetPendingAlbumRemoval()呼び出しごとに新しい
      // オブジェクトが生成されるため、ここでもあえて新規オブジェクトを渡す。
      act(() => {
        rerender(
          <AlbumDetailContainer
            albumId="album-1"
            excludeSignal={{ albumId: "album-1", imageId: "img-1" }}
          />,
        );
      });

      // 参照の変化として検知され、再度除外が適用されること
      expect(getLastGridProps().images.map((img) => img.id)).toEqual([]);
    });
  });
});