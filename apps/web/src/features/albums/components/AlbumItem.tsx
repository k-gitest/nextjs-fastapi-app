"use client";

import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComponentAsyncBoundary } from "@/components/async-boundary";
import { AlbumDetailContainer } from "./AlbumDetailContainer";
import type { Album } from "@/features/albums/types";

interface AlbumItemProps {
  album: Album;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onToggleExpand: (album: Album) => void;
  expanded?: boolean;
  disabled?: boolean;
}

/**
 * 削除確認はAlbumPanel側のAlertDialogに一本化した。
 *
 * AlbumItem全体（行＋展開時のAlbum詳細領域）を未所属画像のドロップ先
 * （useDroppable）にしている。展開・未展開に関係なく、
 * このAlbumに関連する領域であればどこにドロップしてもAlbum所属の変更を
 * 受け付ける。DndContext自体はAlbumPanelが提供し、Album内画像の並び替え
 * （AlbumImageGrid側の独立したDndContext）とは完全に分離されたドロップ
 * 領域である。ここでのドロップはAlbum所属の変更のみを行い、並び順
 * （albumDisplayOrder）は変更しない。
 *
 * isOverによるハイライトもdroppable領域全体（このコンポーネントの
 * 外側wrapper）に対して適用する。行だけをハイライトすると、展開中に
 * Album詳細領域へドラッグした際の視覚的フィードバックが分かりにくくなるため。
 */
export const AlbumItem = ({
  album,
  onEdit,
  onDelete,
  onToggleExpand,
  expanded,
  disabled,
}: AlbumItemProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `album-${album.id}`,
    data: { type: "album", albumId: album.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-colors",
        isOver && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded ?? false}
        onClick={() => onToggleExpand(album)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand(album);
          }
        }}
        className={cn(
          "flex items-center justify-between rounded-md border px-4 py-2 cursor-pointer hover:bg-accent",
          expanded && "border-primary bg-accent",
          isOver && "border-primary bg-primary/10",
        )}
      >
        <span className="truncate">{album.name}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(album);
            }}
            disabled={disabled}
            aria-label={`${album.name}を編集`}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(album);
            }}
            disabled={disabled}
            aria-label={`${album.name}を削除`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="bg-muted/50 rounded-lg border p-4 mt-2">
          <ComponentAsyncBoundary componentName="AlbumDetail">
            <AlbumDetailContainer albumId={album.id} />
          </ComponentAsyncBoundary>
        </div>
      )}
    </div>
  );
};