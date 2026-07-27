"use client";

import { useState } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AlbumImageItem, Album } from "@/features/albums/types";

// SelectItemのvalueは文字列必須のため、albumId: nullを表すsentinel。
// このコンポーネント内だけで null への変換を完結させ、呼び出し元（onMove）には
// 決して漏らさない（service/API層はこの文字列の存在を一切知らない）。
const UNASSIGN_VALUE = "__unassign__";

type AlbumImageGridProps = {
  images: AlbumImageItem[];
  // 移動先候補一覧。呼び出し元（AlbumDetailContainer）が自分自身のAlbumを
  // 除外した状態で渡す（Grid側では現在のalbumId自体を知らないため、
  // フィルタリングはContainerの責務とする）。
  otherAlbums: Album[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  onMove: (imageId: string, albumId: string | null) => void;
  deleting?: boolean;
  // PR5-②時点ではGrid全体で単一のpending状態を共有する
  // （UnassignedImageGridのassigning={assigning}と同じ既存パターンを踏襲）。
  // そのため1枚移動中は他の画像のSelectも一時的にdisabledになる。
  // 個別pending管理が必要になった場合は別途対応する。
  moving?: boolean;
};

/**
 * Album詳細画面用の画像一覧グリッド（Presentational Component）。
 *
 * PR5-②での変更点:
 *   削除に加え、Album間移動・未所属への移動（onMove）を追加した。
 *   UnassignedImageGridの「アルバムへ移動」Selectパターンを踏襲しつつ、
 *   こちらは「未所属に戻す」選択肢と「自分自身のAlbumを候補から除外」の2点が異なる。
 *
 * データ取得・Mutation・キャッシュ更新は持たない。
 * images・otherAlbums・onDelete・onMove はすべて親（AlbumDetailContainer）から渡される。
 */
export const AlbumImageGrid = ({
  images,
  otherAlbums,
  onDelete,
  onMove,
  deleting,
  moving,
}: AlbumImageGridProps) => {
  const [confirmTarget, setConfirmTarget] = useState<AlbumImageItem | null>(
    null,
  );

  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        このアルバムにはまだ画像がありません
      </p>
    );
  }

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    onDelete(confirmTarget.id, () => setConfirmTarget(null));
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((image) => {
          const previewUrl = `/api/images/${image.id}/view`;

          return (
            <div key={image.id} className="w-24 space-y-1">
              <div className="group relative h-24 w-24 overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={image.originalFileName}
                  className="h-full w-full object-cover"
                />

                {image.usageCount > 0 && (
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                    {image.usageCount}件で使用中
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmTarget(image)}
                  disabled={deleting}
                  aria-label={`${image.originalFileName}を削除`}
                  className="absolute right-1 top-1 h-6 w-6 bg-black/70 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5 text-white" />
                </Button>
              </div>

              <Select
                onValueChange={(value) =>
                  onMove(image.id, value === UNASSIGN_VALUE ? null : value)
                }
                disabled={moving}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="他のアルバムへ移動" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGN_VALUE}>未所属に戻す</SelectItem>
                  {otherAlbums.map((album) => (
                    <SelectItem key={album.id} value={album.id}>
                      {album.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              画像を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget && confirmTarget.usageCount > 0 ? (
                <>
                  この画像は{confirmTarget.usageCount}
                  件のTodoで使用されています。削除すると、これらのTodoからも画像の添付が削除されます。この操作は取り消せません。
                </>
              ) : (
                <>この画像を削除します。この操作は取り消せません。</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};