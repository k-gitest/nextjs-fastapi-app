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
import type { ImageSummary } from "@/features/images/types";
import type { Album } from "@/features/albums/types";

type UnassignedImageGridProps = {
  images: ImageSummary[];
  albums: Album[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  onUpdateAlbum: (imageId: string, albumId: string) => void;
  deleting?: boolean;
  assigning?: boolean;
};

/**
 * 未所属画像（albumId = null）一覧グリッド（Presentational Component）。
 *
 * 削除に加え、各画像にAlbum選択UIを持つ。選択すると即座にonUpdateAlbumを呼び、
 * 成功時にはこの画像自体が一覧から消える（親のuseUnassignedImagesが再取得するため）。
 * Album変更は確認ダイアログを経由しない即時操作のため、削除操作のような
 * onSuccessコールバックは受け取らない（Select選択→Mutation→invalidateで完結する）。
 *
 * Albumが1件も無い場合はSelect自体を表示しない（AlbumSelectorの既存方針を踏襲）。
 */
export const UnassignedImageGrid = ({
  images,
  albums,
  onDelete,
  onUpdateAlbum,
  deleting,
  assigning,
}: UnassignedImageGridProps) => {
  const [confirmTarget, setConfirmTarget] = useState<ImageSummary | null>(null);

  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">未所属の画像はありません</p>
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

              {albums.length > 0 && (
                <Select
                  onValueChange={(albumId) => onUpdateAlbum(image.id, albumId)}
                  name={`unassigned-image-${image.id}-album`}
                  disabled={assigning}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="アルバムへ移動" />
                  </SelectTrigger>
                  <SelectContent>
                    {albums.map((album) => (
                      <SelectItem key={album.id} value={album.id}>
                        {album.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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