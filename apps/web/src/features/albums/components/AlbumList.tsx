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
}

export const AlbumList = ({
  albums,
  onEdit,
  onDelete,
  onToggleExpand,
  expandedAlbumIds,
  disabled,
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
        />
      ))}
    </div>
  );
};