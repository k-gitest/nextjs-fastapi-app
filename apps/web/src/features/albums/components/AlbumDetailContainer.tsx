"use client";

import { useState } from "react";
import { useAlbumDetail } from "../hooks/useAlbumDetail";
import { useAlbums } from "../hooks/useAlbums";
import { useDeleteImage } from "../hooks/useDeleteImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import { AlbumImageGrid } from "./AlbumImageGrid";

type AlbumDetailContainerProps = {
  albumId: string;
  excludeSignal?: { albumId: string; imageId: string };
};

export const AlbumDetailContainer = ({
  albumId,
  excludeSignal,
}: AlbumDetailContainerProps) => {
  const { album } = useAlbumDetail(albumId);
  const { albums } = useAlbums();
  const deleteMutation = useDeleteImage();
  const moveMutation = useUpdateImageAlbum();

  const [movingImageId, setMovingImageId] = useState<string | null>(null);
  const [prevExcludeSignal, setPrevExcludeSignal] = useState(excludeSignal);

  // AlbumPanel由来の除外信号をローカルstateへ取り込む。
  // excludeSignalはAlbumPanelがsetPendingAlbumRemoval()のたびに新規生成する
  // オブジェクト参照であり、同一imageId/albumIdの組が再度渡された場合でも
  // 参照としては別物になる。そのため値ではなく参照の変化として検知することで、
  // 同一画像の往復移動（例: Album→未所属→Album→未所属）でも2回目以降の
  // 移動を確実に検知できる（値のみの比較では2回目以降が検知されず、
  // 楽観的除外が効かないままdnd-kitのSortable要素が残り続けてしまう）。
  // 取り込み後の解除は下のif文（実データ駆動）が担当するため、
  // AlbumPanel側がonSettled等でこの値を正確なタイミングでクリアする必要はない。
  if (excludeSignal !== prevExcludeSignal) {
    const previousImageId = prevExcludeSignal?.imageId;
    setPrevExcludeSignal(excludeSignal);
    if (excludeSignal) {
      setMovingImageId(excludeSignal.imageId);
    } else if (movingImageId === previousImageId) {
      // AlbumPanel側がMutation失敗を検知して信号をクリアした場合、
      // または別のAlbumへの移動が新たに始まった場合
      // （excludeSignal: 値 → undefined）、ローカルの除外も合わせて解除する。
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
