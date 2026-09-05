"use client";

import { useState } from "react";
import { ImageIcon, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
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
import type { AlbumImageItem, Album } from "@/features/albums/types";

const UNASSIGN_VALUE = "__unassign__";

type AlbumImageGridProps = {
  images: AlbumImageItem[];
  otherAlbums: Album[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  onMove: (imageId: string, albumId: string | null) => void;
  // 並び替え確定時(drop時)に呼ばれる。imageIdsは並び替え後の全画像ID配列。
  onReorder: (imageIds: string[]) => void;
  deleting?: boolean;
  moving?: boolean;
};

/**
 * Album詳細画面用の画像一覧グリッド(Presentational Component)。
 *
 * ドラッグ中の視覚的な移動はdnd-kitのtransformが処理するため、
 * ローカルな並び順stateは持たない。propsのimagesをそのまま表示し、
 * drop確定時にarrayMoveした結果のID配列をonReorderで親へ渡すのみ。
 */
export const AlbumImageGrid = ({
  images,
  otherAlbums,
  onDelete,
  onMove,
  onReorder,
  deleting,
  moving,
}: AlbumImageGridProps) => {
  const [confirmTarget, setConfirmTarget] = useState<AlbumImageItem | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((img) => img.id === active.id);
    const newIndex = images.findIndex((img) => img.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(images, oldIndex, newIndex);
    onReorder(reordered.map((img) => img.id));
  };

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={images.map((img) => img.id)}
          strategy={rectSortingStrategy}
        >
          <div className="flex flex-wrap gap-2">
            {images.map((image) => (
              <SortableImageCard
                key={image.id}
                image={image}
                onDeleteClick={() => setConfirmTarget(image)}
                onMove={onMove}
                otherAlbums={otherAlbums}
                deleting={deleting}
                moving={moving}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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

type SortableImageCardProps = {
  image: AlbumImageItem;
  onDeleteClick: () => void;
  onMove: (imageId: string, albumId: string | null) => void;
  otherAlbums: Album[];
  deleting?: boolean;
  moving?: boolean;
};

const SortableImageCard = ({
  image,
  onDeleteClick,
  onMove,
  otherAlbums,
  deleting,
  moving,
}: SortableImageCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
          aria-label={`${image.originalFileName}を並び替え`}
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
};