"use client";

import { useState } from "react";
import { useAlbumDetail } from "../hooks/useAlbumDetail";
import { useAlbums } from "../hooks/useAlbums";
import { useDeleteImage } from "../hooks/useDeleteImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import { AlbumImageGrid } from "./AlbumImageGrid";

type AlbumDetailContainerProps = {
  albumId: string;
  excludeImageId?: string;
};

export const AlbumDetailContainer = ({
  albumId,
  excludeImageId,
}: AlbumDetailContainerProps) => {
  const { album } = useAlbumDetail(albumId);
  const { albums } = useAlbums();
  const deleteMutation = useDeleteImage();
  const moveMutation = useUpdateImageAlbum();

  const [movingImageId, setMovingImageId] = useState<string | null>(null);
  const [prevExcludeImageId, setPrevExcludeImageId] = useState(excludeImageId);

  // AlbumPanel由来の除外信号をローカルstateへ取り込む。
  // 取り込み後の解除は下のif文（実データ駆動）が担当するため、
  // AlbumPanel側がonSettled等でこの値を正確なタイミングでクリアする必要はない。
  if (excludeImageId !== prevExcludeImageId) {
    setPrevExcludeImageId(excludeImageId);
    if (excludeImageId) {
      setMovingImageId(excludeImageId);
    } else if (movingImageId === prevExcludeImageId) {
      // AlbumPanel側がMutation失敗を検知して信号をクリアした場合
      // （excludeImageId: 値 → undefined）、ローカルの除外も合わせて解除する。
      setMovingImageId(null);
    }
  }

  // SelectによるAlbum移動。
  if (
    movingImageId !== null &&
    !album.images.some((img) => img.id === movingImageId)
  ) {
    setMovingImageId(null);
  }

  const otherAlbums = albums.filter((a) => a.id !== albumId);

  const visibleImages = album.images.filter((img) => img.id !== movingImageId);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        {album.name}の画像
      </h4>

      <AlbumImageGrid
        albumId={albumId}
        images={visibleImages}
        otherAlbums={otherAlbums}
        onDelete={(imageId, onSuccess) => {
          deleteMutation.mutate({ albumId, imageId }, { onSuccess });
        }}
        onMove={(imageId, targetAlbumId) => {
          setMovingImageId(imageId);

          moveMutation.mutate(
            { imageId, albumId: targetAlbumId },
            {
              onError: () => setMovingImageId(null),
            },
          );
        }}
        deleting={deleteMutation.isPending}
        moving={moveMutation.isPending}
      />
    </div>
  );
};
