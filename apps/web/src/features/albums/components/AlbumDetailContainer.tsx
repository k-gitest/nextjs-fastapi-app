"use client";

import { useState } from "react";
import { useAlbumDetail } from "../hooks/useAlbumDetail";
import { useReorderAlbumImages } from "../hooks/useReorderAlbumImages";
import { useAlbums } from "../hooks/useAlbums";
import { useDeleteImage } from "../hooks/useDeleteImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import { AlbumImageGrid } from "./AlbumImageGrid";
import type { AlbumImageItem } from "../types";

type AlbumDetailContainerProps = {
  albumId: string;
};

export const AlbumDetailContainer = ({
  albumId,
}: AlbumDetailContainerProps) => {
  const { album } = useAlbumDetail(albumId);
  const { albums } = useAlbums();
  const deleteMutation = useDeleteImage();
  const moveMutation = useUpdateImageAlbum();
  const reorderMutation = useReorderAlbumImages(albumId);

  const [movingImageId, setMovingImageId] = useState<string | null>(null);
  // movingImageIdの解除タイミングをalbum.imagesの実データと同期させるための、
  // 前回値比較用state。useEffectでsetStateすると余分なコミットが挟まり
  // 「一瞬Album側に戻る」問題（実機確認済み）の原因になるため、レンダー中に
  // 直接補正する（AlbumPanel.tsxのpendingRemovalImageId/prevUnassignedImages
  // と同じパターン。あちらは未所属→Album方向、こちらはAlbum→未所属/他Album
  // 方向で、対称的な問題に同じ解決策を採用している）。
  const [prevAlbumImages, setPrevAlbumImages] = useState<AlbumImageItem[]>(
    album.images,
  );

  if (album.images !== prevAlbumImages) {
    setPrevAlbumImages(album.images);
    if (
      movingImageId &&
      !album.images.some((img) => img.id === movingImageId)
    ) {
      setMovingImageId(null);
    }
  }

  const otherAlbums = albums.filter((a) => a.id !== albumId);

  const visibleImages = movingImageId
    ? album.images.filter((img) => img.id !== movingImageId)
    : album.images;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        {album.name}の画像
      </h4>
      <AlbumImageGrid
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
        onReorder={(imageIds) => {
          reorderMutation.mutate(imageIds);
        }}
        deleting={deleteMutation.isPending}
        moving={moveMutation.isPending}
      />
    </div>
  );
};