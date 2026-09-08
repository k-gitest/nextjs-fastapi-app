"use client";

import { useState } from "react";
import { ImageIcon, Trash2, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
 * 削除・Album選択（Select）に加え、各画像をドラッグしてAlbumへドロップする
 * ことでもAlbum所属を変更できる。DndContextはAlbumPanelが
 * 提供するため、このコンポーネント自体はDndContextを持たない。
 *
 * ドラッグはグリップハンドル経由に限定し、削除ボタン・Selectのクリックが
 * ドラッグ開始と衝突しないようにしている。Selectは既存の明示的な操作手段として
 * 残しており、ドラッグ操作はそれに対する追加の操作方法という位置づけである
 * （ドラッグはポインター操作のみに依存するため、キーボード操作の代替として
 * Selectを維持する）。
 *
 * 削除中（deleting）・Select経由の移動中（assigning）はドラッグ開始を
 * 無効化する。同一画像に対してSelect経由とDnD経由のMutationが同時に
 * 実行されることを防ぐため。
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
        {images.map((image) => (
          <DraggableUnassignedImageCard
            key={image.id}
            image={image}
            albums={albums}
            onDeleteClick={() => setConfirmTarget(image)}
            onUpdateAlbum={onUpdateAlbum}
            deleting={deleting}
            assigning={assigning}
          />
        ))}
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

type DraggableUnassignedImageCardProps = {
  image: ImageSummary;
  albums: Album[];
  onDeleteClick: () => void;
  onUpdateAlbum: (imageId: string, albumId: string) => void;
  deleting?: boolean;
  assigning?: boolean;
};

const DraggableUnassignedImageCard = ({
  image,
  albums,
  onDeleteClick,
  onUpdateAlbum,
  deleting,
  assigning,
}: DraggableUnassignedImageCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `image-${image.id}`,
      data: { type: "unassigned-image", imageId: image.id },
      disabled: deleting || assigning,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const previewUrl = `/api/images/${image.id}/view`;

  return (
    <div ref={setNodeRef} style={style} className="w-24 space-y-1">
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

        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label={`${image.originalFileName}をドラッグしてアルバムへ移動`}
          className="absolute bottom-1 left-1 flex h-6 w-6 cursor-grab items-center justify-center rounded bg-black/70 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5 text-white" />
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDeleteClick}
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
};