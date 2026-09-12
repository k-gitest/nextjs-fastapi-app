"use client";

import { AlbumItem } from "./AlbumItem";
import type { Album } from "@/features/albums/types";

interface AlbumListProps {
  albums: Album[];
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onToggleExpand: (album: Album) => void;
  expandedAlbumIds: string[];
  disabled?: boolean;
  movingToAlbumId?: string | null;
  pendingRemoval?: { albumId: string; imageId: string } | null;
  onPendingRemovalResolved?: () => void;
}

export const AlbumList = ({
  albums,
  onEdit,
  onDelete,
  onToggleExpand,
  expandedAlbumIds,
  disabled,
  movingToAlbumId,
  pendingRemoval,
}: AlbumListProps) => {
  if (albums.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        アルバムがありません。最初のアルバムを作成してください。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {albums.map((album) => (
        <AlbumItem
          key={album.id}
          album={album}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleExpand={onToggleExpand}
          expanded={expandedAlbumIds.includes(album.id)}
          disabled={disabled}
          isMoving={album.id === movingToAlbumId}
          // pendingRemovalは値ベースの文字列ではなく、AlbumPanel側が
          // setPendingAlbumRemoval()のたびに生成する新しいオブジェクト参照
          // そのままを下流へ渡す。同一imageId/albumIdの組で再度移動が
          // 発生した場合（例: X→未所属→X→未所属の往復）でも、値ではなく
          // 参照の変化としてAlbumDetailContainer側が検知できるようにするため。
          // 値だけを取り出して文字列propに変換すると、2回目以降の同一imageId
          // での除外が変化として検知されず、楽観的除外が効かないまま
          // dnd-kitのSortable要素が残り続けて「一瞬元に戻る」アニメーションの
          // 原因になる。
          excludeSignal={
            pendingRemoval?.albumId === album.id ? pendingRemoval : undefined
          }
        />
      ))}
    </div>
  );
};