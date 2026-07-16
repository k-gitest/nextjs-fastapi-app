"use client";

import { AlbumItem } from "./AlbumItem";
import type { Album } from "@/features/albums/types";

interface AlbumListProps {
  albums: Album[];
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  disabled?: boolean;
}

export const AlbumList = ({ albums, onEdit, onDelete, disabled }: AlbumListProps) => {
  if (albums.length === 0) {
    // 最終設計としてはUser作成時にデフォルトAlbumを自動生成する方針だが、
    // Phase3-3時点では未実装のためフォールバック表示とする。
    // 将来デフォルトAlbum自動生成を実装した後も、生成に万一失敗した場合の保険として残す。
    return (
      <p className="text-sm text-muted-foreground py-4">
        アルバムがありません。最初のアルバムを作成してください。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {albums.map((album) => (
        <AlbumItem key={album.id} album={album} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
      ))}
    </div>
  );
};