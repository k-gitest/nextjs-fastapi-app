"use client";

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
 * ここで個別にAlertDialogを持たせると、確認ダイアログが二重になり
 * 文言も不整合を起こすため、このコンポーネントは表示・展開・イベント委譲のみを担う。
 *
 * 「行（クリックでトグルする見出し部分）」と「展開コンテンツ」はDOM上で兄弟要素に
 * 分離している。これは、展開コンテンツ（AlbumDetailContainer → AlbumImageGrid）内の
 * 削除・移動操作のクリックが、外側のトグル用onClickへ伝播して意図せず折りたたまれる
 * ことを防ぐための構造。編集・削除ボタンのstopPropagationと同じ問題を、兄弟分離に
 * よって構造的に回避している（issue: 3）。
 *
 * AlbumDetailContainerはalbumIdのみで自己完結するContainerであり、AlbumItemに
 * 新たなデータ取得ロジックを持ち込むものではないため、ここで直接描画してよいと判断した。
 */
export const AlbumItem = ({
  album,
  onEdit,
  onDelete,
  onToggleExpand,
  expanded,
  disabled,
}: AlbumItemProps) => {
  return (
    <div>
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