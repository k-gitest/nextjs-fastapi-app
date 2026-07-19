"use client";

import { useAlbumDetail } from "../hooks/useAlbumDetail";
import { useDeleteImage } from "../hooks/useDeleteImage";
import { AlbumImageGrid } from "./AlbumImageGrid";

type AlbumDetailContainerProps = {
  albumId: string;
};

/**
 * 選択中Albumの詳細（画像一覧・usageCount）を表示するContainer。
 * useAlbumDetailがuseApiSuspenseQueryベースのため、呼び出し元で
 * ComponentAsyncBoundaryに包んで使うこと（このコンポーネント自体はSuspense境界を持たない）。
 */
export const AlbumDetailContainer = ({ albumId }: AlbumDetailContainerProps) => {
  const { album } = useAlbumDetail(albumId);
  const deleteMutation = useDeleteImage();

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{album.name}の画像</h4>
      <AlbumImageGrid
        images={album.images}
        onDelete={(imageId, onSuccess) => {
          deleteMutation.mutate({ albumId, imageId }, { onSuccess });
        }}
        deleting={deleteMutation.isPending}
      />
    </div>
  );
};