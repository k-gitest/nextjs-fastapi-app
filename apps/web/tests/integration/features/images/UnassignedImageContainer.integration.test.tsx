import { render } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { UnassignedImageContainer } from "@/features/images/components/UnassignedImageContainer";
import { useUnassignedImages } from "@/features/images/hooks/useUnassignedImages";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { useDeleteUnassignedImage } from "@/features/images/hooks/useDeleteUnassignedImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import type { ImageSummary } from "@/features/images/types";
import type { Album } from "@/features/albums/types";

// UnassignedImageGrid自体のUI・Select・削除確認ダイアログの挙動はUnassignedImageGrid.test.tsx
// で実物レンダリングして検証済みのため、ここではモックに差し替え、Containerが
// 各フックの戻り値・mutationを正しく橋渡ししているかのみを検証する（責務の重複を避ける）。
type CapturedUnassignedImageGridProps = {
  images: ImageSummary[];
  albums: Album[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  onUpdateAlbum: (imageId: string, albumId: string) => void;
  deleting?: boolean;
  assigning?: boolean;
};

const { mockUnassignedImageGridImpl } = vi.hoisted(() => ({
  mockUnassignedImageGridImpl: vi.fn(),
}));
mockUnassignedImageGridImpl.mockImplementation(() => null);

vi.mock("@/features/images/components/UnassignedImageGrid", () => ({
  UnassignedImageGrid: (props: CapturedUnassignedImageGridProps) =>
    mockUnassignedImageGridImpl(props),
}));

vi.mock("@/features/images/hooks/useUnassignedImages");
vi.mock("@/features/albums/hooks/useAlbums");
vi.mock("@/features/images/hooks/useDeleteUnassignedImage");
vi.mock("@/features/images/hooks/useUpdateImageAlbum");

describe("UnassignedImageContainer", () => {
  const mockImages: ImageSummary[] = [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
    },
  ];

  const mockAlbumsList: Album[] = [
    {
      id: "album-1",
      name: "夏休み",
      userId: "user-1",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
    } as Album,
  ];

  const mockDeleteMutate = vi.fn();
  const mockUpdateAlbumMutate = vi.fn();

  const getLastGridProps = (): CapturedUnassignedImageGridProps => {
    const calls = mockUnassignedImageGridImpl.mock.calls;
    return calls[calls.length - 1][0] as CapturedUnassignedImageGridProps;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useUnassignedImages as Mock).mockReturnValue({ images: mockImages });
    (useAlbums as Mock).mockReturnValue({ albums: mockAlbumsList });
    (useDeleteUnassignedImage as Mock).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });
    (useUpdateImageAlbum as Mock).mockReturnValue({
      mutate: mockUpdateAlbumMutate,
      isPending: false,
    });
  });

  it("useUnassignedImagesで取得したimagesがそのままUnassignedImageGridへ渡されること", () => {
    render(<UnassignedImageContainer />);
    const props = getLastGridProps();
    expect(props.images).toBe(mockImages);
  });

  it("useAlbumsで取得したalbumsがそのままUnassignedImageGridへ渡されること", () => {
    render(<UnassignedImageContainer />);
    const props = getLastGridProps();
    expect(props.albums).toBe(mockAlbumsList);
  });

  it("onDeleteが呼ばれると、deleteMutation.mutateへimageIdとonSuccessコールバックが渡されること", () => {
    render(<UnassignedImageContainer />);
    const props = getLastGridProps();
    const onSuccessCallback = vi.fn();

    props.onDelete("img-1", onSuccessCallback);

    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate).toHaveBeenCalledWith("img-1", {
      onSuccess: onSuccessCallback,
    });
  });

  it("onUpdateAlbumが呼ばれると、updateAlbumMutation.mutateへ{imageId, albumId}が渡されること", () => {
    render(<UnassignedImageContainer />);
    const props = getLastGridProps();

    props.onUpdateAlbum("img-1", "album-1");

    expect(mockUpdateAlbumMutate).toHaveBeenCalledTimes(1);
    expect(mockUpdateAlbumMutate).toHaveBeenCalledWith({
      imageId: "img-1",
      albumId: "album-1",
    });
  });

  it("deleteMutation.isPendingがtrueのとき、UnassignedImageGridへdeleting=trueが渡されること", () => {
    (useDeleteUnassignedImage as Mock).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: true,
    });

    render(<UnassignedImageContainer />);
    const props = getLastGridProps();

    expect(props.deleting).toBe(true);
  });

  it("updateAlbumMutation.isPendingがtrueのとき、UnassignedImageGridへassigning=trueが渡されること", () => {
    (useUpdateImageAlbum as Mock).mockReturnValue({
      mutate: mockUpdateAlbumMutate,
      isPending: true,
    });

    render(<UnassignedImageContainer />);
    const props = getLastGridProps();

    expect(props.assigning).toBe(true);
  });
});