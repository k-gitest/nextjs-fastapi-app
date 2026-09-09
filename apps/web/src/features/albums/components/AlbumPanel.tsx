"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LibraryImageUploader } from "@/features/images/components/LibraryImageUploader";
import { UnassignedImageContainer } from "@/features/images/components/UnassignedImageContainer";
import { ImageDragPreview } from "@/features/images/components/ImageDragPreview";
import { useUnassignedImages } from "@/features/images/hooks/useUnassignedImages";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
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
import { ComponentAsyncBoundary } from "@/components/async-boundary";
import { AlbumList } from "./AlbumList";
import { AlbumCreateDialog } from "./AlbumCreateDialog";
import { AlbumEditDialog } from "./AlbumEditDialog";
import { useAlbums } from "../hooks/useAlbums";
import { useCreateAlbum } from "../hooks/useCreateAlbum";
import { useUpdateAlbum } from "../hooks/useUpdateAlbum";
import { useDeleteAlbum } from "../hooks/useDeleteAlbum";
import type { Album } from "../types";

/**
 * Album CRUD + 各行直下への詳細展開をまとめたパネル。
 * /albumsページに配置する。
 *
 * expandedAlbumIdsはこのコンポーネントが状態を持つ（複数同時展開に対応）。
 * 展開されたAlbumの詳細表示自体はAlbumItemが担当し、AlbumPanelは展開ID集合の
 * 管理のみを行う。
 *
 * 削除確認はここのAlertDialogに一本化している（AlbumItem側には確認UIを持たせない）。
 *
 * ダイアログはMutation成功後にのみ閉じる。
 *
 * 未所属画像をAlbumへドラッグ&ドロップで移動する機能のDndContextをここに持つ。
 * ドラッグ元（未所属画像）・ドロップ先（Album）の両方をこの
 * コンポーネント配下に持つ必要があるため。Album内画像の並び替え
 * （AlbumImageGrid側）は独立した別のDndContextであり、ここでは一切関与しない。
 * 両者はReactツリー上で別のDndContextインスタンスに属するため、ドロップ領域が
 * DOM上で重なっていても内部的な登録・当たり判定は完全に分離される
 * （AlbumItemがAlbum全体をdroppableにしていても、その内部のAlbumImageGridが
 * 独自のDndContextを持つため干渉しない）。
 *
 * ドロップ時はAlbum所属の変更のみを行い、並び順（albumDisplayOrder）は
 * 既存Service層のmax+1採番にそのまま委ねる（順序を明示的に指定する機能は
 * ここでは持たない）。
 *
 * DnDのactive/over dataには識別子と`type`のみを持たせ、表示用の実体
 * （ImageSummary）はDragOverlay側でuseUnassignedImagesのキャッシュから
 * 取得する。同一Query KeyをUnassignedImageContainer側と共有するため、
 * 追加のネットワークリクエストは発生しない。
 */
export const AlbumPanel = () => {
  const { albums } = useAlbums();
  const { images: unassignedImages } = useUnassignedImages();
  const createMutation = useCreateAlbum();
  const updateMutation = useUpdateAlbum();
  const deleteMutation = useDeleteAlbum();
  const moveToAlbumMutation = useUpdateImageAlbum();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState<Album | null>(null);
  const [expandedAlbumIds, setExpandedAlbumIds] = useState<string[]>([]);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [pendingRemovalImageId, setPendingRemovalImageId] = useState<
    string | null
  >(null);
  const [movingToAlbumId, setMovingToAlbumId] = useState<string | null>(null);
  // pendingRemovalImageIdの解除タイミングをunassignedImagesの実データと
  // 同期させるための、前回値比較用ref代わりのstate。useEffectで
  // setStateすると余分なコミットが挟まり「一瞬未所属に戻る」再発の
  // 原因になるため、レンダー中に直接補正する(Reactの推奨パターン)。
  const [prevUnassignedImages, setPrevUnassignedImages] =
    useState(unassignedImages);

  if (unassignedImages !== prevUnassignedImages) {
    setPrevUnassignedImages(unassignedImages);
    if (
      pendingRemovalImageId &&
      !unassignedImages.some((image) => image.id === pendingRemovalImageId)
    ) {
      setPendingRemovalImageId(null);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    moveToAlbumMutation.isPending;

  const draggingImage =
    unassignedImages.find((image) => image.id === draggingImageId) ?? null;

  const handleToggleExpand = (album: Album) => {
    setExpandedAlbumIds((prev) =>
      prev.includes(album.id)
        ? prev.filter((id) => id !== album.id)
        : [...prev, album.id],
    );
  };

  const handleConfirmDelete = () => {
    if (!deletingAlbum) return;
    const targetId = deletingAlbum.id;
    const wasExpanded = expandedAlbumIds.includes(targetId);

    if (wasExpanded) {
      setExpandedAlbumIds((prev) => prev.filter((id) => id !== targetId));
    }

    deleteMutation.mutate(targetId, {
      onSuccess: () => {
        setDeletingAlbum(null);
      },
      onError: () => {
        if (wasExpanded) {
          setExpandedAlbumIds((prev) => [...prev, targetId]);
        }
      },
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type !== "unassigned-image") {
      setDraggingImageId(null);
      return;
    }
    setDraggingImageId(typeof data.imageId === "string" ? data.imageId : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingImageId(null);

    const activeData = event.active.data.current;
    const overData = event.over?.data.current;

    if (activeData?.type !== "unassigned-image" || overData?.type !== "album") {
      return;
    }

    const imageId =
      typeof activeData.imageId === "string" ? activeData.imageId : undefined;
    const albumId =
      typeof overData.albumId === "string" ? overData.albumId : undefined;

    if (!imageId || !albumId) return;

    // dnd-kitのisDraggingは同期的にfalseへ戻るため、Mutation完了(invalidateQueries
    // による再フェッチ完了)を待つと、その間だけ対象画像が未所属一覧の元の位置に
    // 一瞬スナップバックして見える。pendingRemovalImageIdをここで
    // 同期的にセットすることで、isDraggingのリセットと同一レンダーパスで
    // 対象画像を表示から除外し、視覚的なギャップを埋める。
    setPendingRemovalImageId(imageId);

    // 未所属一覧から画像が消えてからAlbum側に反映されるまでの間、
    // ユーザーが「移動が成功したか」を判断できず、ファイルが消失したように
    // 見える可能性がある。ドロップ先のAlbumにのみ
    // ローディング表示を出し、移動中であることを明示する。他のAlbum行は
    // 対象外とし、別画像を別Albumへ続けてドラッグする操作を妨げない。
    setMovingToAlbumId(albumId);

    moveToAlbumMutation.mutate(
      { imageId, albumId },
      {
        onError: () => {
          // 移動が失敗した場合、データ側は変化していないため
          // 除外を即座に解除して元の未所属表示に戻す。
          setPendingRemovalImageId(null);
        },
        onSettled: () => {
          setMovingToAlbumId(null);
        },
      },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <AlbumCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSubmit={async (values) => {
              await createMutation.mutateAsync(values);
            }}
            isLoading={createMutation.isPending}
          />
        </div>

        <AlbumList
          albums={albums}
          onEdit={setEditingAlbum}
          onDelete={setDeletingAlbum}
          onToggleExpand={handleToggleExpand}
          expandedAlbumIds={expandedAlbumIds}
          disabled={isMutating}
          movingToAlbumId={movingToAlbumId}
        />

        <div className="border-t pt-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">未所属の画像</h2>
            <LibraryImageUploader />
          </div>

          <ComponentAsyncBoundary componentName="UnassignedImages">
            <UnassignedImageContainer excludeImageId={pendingRemovalImageId} />
          </ComponentAsyncBoundary>
        </div>

        <AlbumEditDialog
          album={editingAlbum}
          onOpenChange={(open) => {
            if (!open) setEditingAlbum(null);
          }}
          onSubmit={async (values) => {
            if (!editingAlbum) return;
            await updateMutation.mutateAsync({
              id: editingAlbum.id,
              name: values.name,
            });
          }}
          isLoading={updateMutation.isPending}
        />

        <AlertDialog
          open={deletingAlbum !== null}
          onOpenChange={(open) => {
            if (!open) setDeletingAlbum(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>アルバムを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                このアルバム内の画像はすべて削除され、Todoで使用中の画像も削除されます。この操作は取り消せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
              >
                削除する
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <DragOverlay>
        {draggingImage ? <ImageDragPreview image={draggingImage} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
