import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { AlbumDetailContainer } from "@/features/albums/components/AlbumDetailContainer";
import { useAlbumDetail } from "@/features/albums/hooks/useAlbumDetail";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { useDeleteImage } from "@/features/albums/hooks/useDeleteImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import type { AlbumDetail, Album } from "@/features/albums/types";
import type { ImageSummary } from "@/features/images/types";

// AlbumImageGrid自体のUI・移動UIの挙動はAlbumImageGrid.test.tsxで実物レンダリングして
// 検証済みのため、ここではモックに差し替え、Containerが正しいpropsを渡しているかのみを
// 検証する（責務の重複を避ける）。
type CapturedAlbumImageGridProps = {
  images: ImageSummary[];
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
  const mockAlbumImages: ImageSummary[] = [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
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
    expect(props.images).toBe(mockAlbumImages);
  });

  it("otherAlbumsから現在表示中のAlbum自身（album-1）が除外されること", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();
    expect(props.otherAlbums.map((a) => a.id)).toEqual([
      "album-2",
      "album-3",
    ]);
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

  it("onMoveが呼ばれると、moveMutation.mutateへ{imageId, albumId}が渡されること（Album指定時）", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();

    props.onMove("img-1", "album-2");

    expect(mockMoveMutate).toHaveBeenCalledTimes(1);
    expect(mockMoveMutate).toHaveBeenCalledWith({
      imageId: "img-1",
      albumId: "album-2",
    });
  });

  it("onMoveがalbumId=nullで呼ばれると、moveMutation.mutateへもalbumId=nullがそのまま渡されること（未所属へ戻す）", () => {
    render(<AlbumDetailContainer albumId="album-1" />);
    const props = getLastGridProps();

    props.onMove("img-1", null);

    expect(mockMoveMutate).toHaveBeenCalledTimes(1);
    expect(mockMoveMutate).toHaveBeenCalledWith({
      imageId: "img-1",
      albumId: null,
    });
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
});