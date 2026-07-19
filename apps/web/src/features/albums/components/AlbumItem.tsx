"use client";

import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Album } from "@/features/albums/types";

interface AlbumItemProps {
  album: Album;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onSelect: (album: Album) => void;
  selected?: boolean;
  disabled?: boolean;
}

/**
 * 削除確認はAlbumPanel側のAlertDialogに一本化した。
 * ここで個別にAlertDialogを持たせると、確認ダイアログが二重になり
 * 文言も不整合を起こすため、このコンポーネントは表示・選択・イベント委譲のみを担う。
 *
 * onSelect: 行クリックでAlbum詳細（AlbumImageGrid）を表示するための選択操作。
 * 編集・削除ボタンのクリックが選択イベントへ伝播しないようstopPropagationする。
 */
export const AlbumItem = ({ album, onEdit, onDelete, onSelect, selected, disabled }: AlbumItemProps) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(album)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(album);
      }}
      className={cn(
        "flex items-center justify-between rounded-md border px-4 py-2 cursor-pointer hover:bg-accent",
        selected && "border-primary bg-accent",
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
  );
};