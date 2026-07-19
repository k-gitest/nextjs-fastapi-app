"use client";

import { AlbumItem } from "./AlbumItem";
import type { Album } from "@/features/albums/types";

interface AlbumListProps {
  albums: Album[];
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onSelect: (album: Album) => void;
  selectedAlbumId?: string | null;
  disabled?: boolean;
}

export const AlbumList = ({ albums, onEdit, onDelete, onSelect, selectedAlbumId, disabled }: AlbumListProps) => {
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
          onSelect={onSelect}
          selected={album.id === selectedAlbumId}
          disabled={disabled}
        />
      ))}
    </div>
  );
};