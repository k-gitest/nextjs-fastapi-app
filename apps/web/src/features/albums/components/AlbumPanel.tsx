"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
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
import { useReorderAlbumImages } from "../hooks/useReorderAlbumImages";
import { albumDetailQueryKey } from "../lib/queryKeys";
import type { Album, AlbumDetail } from "../types";

/**
 * Album CRUD + 各行直下への詳細展開をまとめたパネル。
 * /albumsページに配置する。
 *
 * DndContextは以下3種類のドラッグ操作をすべて一元的に扱う（Issue #36）。
 *   1. 未所属画像 → Album（既存）
 *   2. Album内画像の並び替え（旧AlbumImageGrid内蔵DndContextから移管）
 *   3. Album内画像 → 別Album（新規、Issue #36本体）
 *
 * dnd-kitの当たり判定は同一DndContext内でしか成立しないため、ドラッグ元
 * （展開中Albumの画像グリッド・未所属一覧）とドロップ先（すべてのAlbum行）を
 * 両方含むこのコンポーネントにDndContextを集約している。
 *
 * Album内reorderの実行に必要な「現在の画像順序」は、AlbumPanel自身が
 * 保持するのではなくqueryClient.getQueryData()でAlbumDetailのキャッシュを
 * 参照して都度算出する。この読み取りはimageIds配列を組み立てる目的に限定し、
 * AlbumPanelからsetQueryDataは行わない。キャッシュの更新は既存の
 * useReorderAlbumImages（onMutateでの楽観的更新・onErrorでのrollback・
 * onSettledでのinvalidateQueries）にそのまま委ねる。
 */
export const AlbumPanel = () => {
  const queryClient = useQueryClient();
  const { albums } = useAlbums();
  const { images: unassignedImages } = useUnassignedImages();
  const createMutation = useCreateAlbum();
  const updateMutation = useUpdateAlbum();
  const deleteMutation = useDeleteAlbum();
  const moveToAlbumMutation = useUpdateImageAlbum();
  const reorderMutation = useReorderAlbumImages();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState<Album | null>(null);
  const [expandedAlbumIds, setExpandedAlbumIds] = useState<string[]>([]);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [pendingRemovalImageId, setPendingRemovalImageId] = useState<
    string | null
  >(null);
  const [movingToAlbumId, setMovingToAlbumId] = useState<string | null>(null);
  const [pendingAlbumRemoval, setPendingAlbumRemoval] = useState<{
    albumId: string;
    imageId: string;
  } | null>(null);

  // pendingRemovalImageIdの解除タイミングをunassignedImagesの実データと
  // 同期させるための、前回値比較用state。useEffectでsetStateすると余分な
  // コミットが挟まり「一瞬未所属に戻る」再発の原因になるため、レンダー中に
  // 直接補正する（Reactの推奨パターン）。
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

  // ドラッグ中プレビュー画像の実体。未所属画像はunassignedImagesのキャッシュから、
  // Album内画像は展開中Albumのキャッシュ（AlbumDetail）から探す。
  // dnd-kitのdataペイロードに画像実体そのものは積まず、既存のimageIdのみを
  // 積んで必要な時にキャッシュを参照する流儀に統一している。
  const draggingImage = useMemo(() => {
    if (!draggingImageId) return null;
    const fromUnassigned = unassignedImages.find(
      (image) => image.id === draggingImageId,
    );
    if (fromUnassigned) return fromUnassigned;

    for (const albumId of expandedAlbumIds) {
      const cached = queryClient.getQueryData<AlbumDetail>(
        albumDetailQueryKey(albumId),
      );
      const found = cached?.images.find((img) => img.id === draggingImageId);
      if (found) return found;
    }
    return null;
  }, [draggingImageId, unassignedImages, expandedAlbumIds, queryClient]);

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
    if (data?.type === "unassigned-image" || data?.type === "album-image") {
      setDraggingImageId(
        typeof data.imageId === "string" ? data.imageId : null,
      );
      return;
    }
    setDraggingImageId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingImageId(null);

    const activeData = event.active.data.current;
    const overData = event.over?.data.current;
    if (!overData) return;

    // ケース1: 未所属画像 → Album（既存挙動、変更なし）
    if (activeData?.type === "unassigned-image") {
      if (overData.type !== "album") return;

      const imageId =
        typeof activeData.imageId === "string" ? activeData.imageId : undefined;
      const albumId =
        typeof overData.albumId === "string" ? overData.albumId : undefined;
      if (!imageId || !albumId) return;

      setPendingRemovalImageId(imageId);
      setMovingToAlbumId(albumId);

      moveToAlbumMutation.mutate(
        { imageId, albumId },
        {
          onError: () => setPendingRemovalImageId(null),
          onSettled: () => setMovingToAlbumId(null),
        },
      );
      return;
    }

    // ケース2・3: Album内画像 → 同一Album内reorder、または別Albumへの移動
    if (activeData?.type === "album-image") {
      const imageId =
        typeof activeData.imageId === "string" ? activeData.imageId : undefined;
      const sourceAlbumId =
        typeof activeData.sourceAlbumId === "string"
          ? activeData.sourceAlbumId
          : undefined;
      if (!imageId || !sourceAlbumId) return;

      // ドロップ先albumIdは、他の画像カード上（album-image）へのドロップと
      // Album行/展開領域自体（album）へのドロップの両方から解決する。
      let targetAlbumId: string | undefined;
      if (overData.type === "album-image") {
        targetAlbumId =
          typeof overData.sourceAlbumId === "string"
            ? overData.sourceAlbumId
            : undefined;
      } else if (overData.type === "album") {
        targetAlbumId =
          typeof overData.albumId === "string" ? overData.albumId : undefined;
      }
      if (!targetAlbumId) return;

      if (targetAlbumId === sourceAlbumId) {
        // 同一Album内reorder。他の画像カード上へのドロップのみ意味を持つ
        // （Album行自体へのドロップは位置を特定できないためno-op）。
        if (overData.type !== "album-image") return;

        const overImageId =
          typeof overData.imageId === "string" ? overData.imageId : undefined;
        if (!overImageId || overImageId === imageId) return;

        const cached = queryClient.getQueryData<AlbumDetail>(
          albumDetailQueryKey(sourceAlbumId),
        );
        if (!cached) return;

        const oldIndex = cached.images.findIndex((img) => img.id === imageId);
        const newIndex = cached.images.findIndex(
          (img) => img.id === overImageId,
        );
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(cached.images, oldIndex, newIndex);
        reorderMutation.mutate({
          albumId: sourceAlbumId,
          imageIds: reordered.map((img) => img.id),
        });
        return;
      }

      // 別Albumへの移動。順序は既存Service層のmax+1採番（末尾追加）に委ねる。
      // 折りたたまれたAlbumへのドロップも、AlbumItemのdroppable範囲
      // （行＋展開領域）に含まれるため受け付ける。
      //
      // 移動元AlbumのキャッシュはinvalidateQueries完了まで古いままのため、
      // ドロップ直後は移動元表示から即座に除外する（クリアタイミングの
      // 根拠はファイル冒頭コメント参照）。
      setPendingAlbumRemoval({ albumId: sourceAlbumId, imageId });
      setMovingToAlbumId(targetAlbumId);

      moveToAlbumMutation.mutate(
        { imageId, albumId: targetAlbumId },
        {
          onError: () => setPendingAlbumRemoval(null),
          onSettled: () => setMovingToAlbumId(null),
        },
      );
      return;
    }
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
          pendingRemoval={pendingAlbumRemoval}
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
