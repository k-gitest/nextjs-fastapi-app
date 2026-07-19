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
import { Button } from "@/components/ui/button";
import type { AlbumImageItem } from "@/features/albums/types";

type AlbumImageGridProps = {
  images: AlbumImageItem[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  deleting?: boolean;
};

/**
 * Album詳細画面用の画像一覧グリッド（Presentational Component）。
 *
 * Todo添付用の ImageGallery とは責務が別。ImageGalleryは useImageList が管理する
 * アップロード中の状態（ImageItem）を扱うのに対し、こちらは既に確定済みの
 * 読み取り専用データ（AlbumImageItem・usageCount込み）を並べるだけ。
 *
 * データ取得・削除Mutation・キャッシュ更新は持たない。
 * images・onDelete はすべて親（AlbumDetailContainer）から渡される。
 *
 * previewUrl はサーバーDTOに含めず、ここでクライアント側から組み立てる
 * （`/api/images/{id}/view` というルーティング知識はUI側の責務、という既存方針と統一）。
 *
 * 削除確認ダイアログはMutation成功後にのみ閉じる。AlertDialogActionは
 * クリック時に自前でclose処理を持つため使わず、通常のButtonで自前closeにしている
 * （失敗時にダイアログだけ先に閉じてしまうのを防ぐため）。
 */
export const AlbumImageGrid = ({ images, onDelete, deleting }: AlbumImageGridProps) => {
  const [confirmTarget, setConfirmTarget] = useState<AlbumImageItem | null>(null);

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
            <div
              key={image.id}
              className="group relative h-24 w-24 overflow-hidden rounded-md border"
            >
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
                  件のTodoで使用されています。削除するとそれらのTodoからも画像が外れます。この操作は取り消せません。
                </>
              ) : (
                <>この画像を削除します。この操作は取り消せません。</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};