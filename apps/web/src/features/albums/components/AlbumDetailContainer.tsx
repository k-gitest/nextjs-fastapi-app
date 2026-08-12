"use client";

import { useAlbumDetail } from "../hooks/useAlbumDetail";
import { useAlbums } from "../hooks/useAlbums";
import { useDeleteImage } from "../hooks/useDeleteImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import { AlbumImageGrid } from "./AlbumImageGrid";

type AlbumDetailContainerProps = {
  albumId: string;
};

/**
 * 選択中Albumの詳細（画像一覧・usageCount）を表示するContainer。
 * useAlbumDetail・useAlbumsがともにuseApiSuspenseQueryベースのため、呼び出し元で
 * ComponentAsyncBoundaryに包んで使うこと（このコンポーネント自体はSuspense境界を持たない）。
 *
 *   useAlbums()から取得したotherAlbums（現在のAlbumを除いた移動先候補）を組み立てて
 *   AlbumImageGridへ渡す。useUpdateImageAlbum（images側の既存フック）をそのまま使い、
 *   Album間移動をalbumIdの単純な付け替えとして扱う
 *   （移動元を明示的に追跡する必要がないことは設計確認済み。
 *   invalidateQueries(["albums"])がprefix matchで移動元・移動先双方のAlbum詳細クエリを
 *   まとめて無効化するため）。
 */
export const AlbumDetailContainer = ({ albumId }: AlbumDetailContainerProps) => {
  const { album } = useAlbumDetail(albumId);
  const { albums } = useAlbums();
  const deleteMutation = useDeleteImage();
  const moveMutation = useUpdateImageAlbum();

  const otherAlbums = albums.filter((a) => a.id !== albumId);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{album.name}の画像</h4>
      <AlbumImageGrid
        images={album.images}
        otherAlbums={otherAlbums}
        onDelete={(imageId, onSuccess) => {
          deleteMutation.mutate({ albumId, imageId }, { onSuccess });
        }}
        onMove={(imageId, targetAlbumId) => {
          moveMutation.mutate({ imageId, albumId: targetAlbumId });
        }}
        deleting={deleteMutation.isPending}
        moving={moveMutation.isPending}
      />
    </div>
  );
};