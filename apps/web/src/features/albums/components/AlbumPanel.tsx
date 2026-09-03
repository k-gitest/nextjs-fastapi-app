"use client";

import { useState } from "react";
import { LibraryImageUploader } from "@/features/images/components/LibraryImageUploader";
import { UnassignedImageContainer } from "@/features/images/components/UnassignedImageContainer";
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
 * 「選択（selection・単一）」ではなく「展開（expansion・複数可）」の概念に変更した
 * （issue: 3、行直下inline展開への移行）。展開されたAlbumの詳細表示自体は
 * AlbumItemが担当し、AlbumPanelは展開ID集合の管理のみを行う
 * （AlbumDetailContainerをAlbumPanelから直接描画する構成は廃止）。
 *
 * 削除確認はここのAlertDialogに一本化している（AlbumItem側には確認UIを持たせない。
 * AlbumItemはイベント通知のみ、確認・Mutationの責務はこちらが持つ）。
 *
 * Album削除の仕様変更: albumService.deleteAlbum()が所属Imageを
 * deleteImageInTransaction()経由で全削除した上でAlbumを削除する
 * （Todoで使用中の画像も含めて削除される）。確認なしに実行できる破壊的操作になったため、
 * AlertDialogによる確認を必須化している。
 *
 * ダイアログはMutation成功後にのみ閉じる（楽観的にsetDeletingAlbum(null)を先に呼ぶと、
 * API失敗時もダイアログだけ閉じてしまうため）。
 */
export const AlbumPanel = () => {
  const { albums } = useAlbums();
  const createMutation = useCreateAlbum();
  const updateMutation = useUpdateAlbum();
  const deleteMutation = useDeleteAlbum();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState<Album | null>(null);
  const [expandedAlbumIds, setExpandedAlbumIds] = useState<string[]>([]);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

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

    // 展開中Albumを削除する場合、削除確定と同時に展開状態からも外す。
    // useDeleteAlbum内のinvalidateQueries(["albums"])はprefix matchで
    // ["albums", targetId]（AlbumDetailContainerが使うクエリ）も対象になるため、
    // Mutation成功後に展開解除するとAlbumDetailContainerがまだマウントされたまま
    // 再フェッチが走り、削除済みAlbumへの404が発生する。
    // そのため、Mutation開始前（＝ここ）で先に展開解除し、AlbumDetailContainerを
    // アンマウントしてからinvalidateQueriesが走るようにする。
    // 失敗時はonErrorで展開状態を復元する（wasExpandedをここで確定させておくことで、
    // onSuccess/onError双方が「削除確定時点で展開中だったか」を参照できるようにする）。
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

  return (
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
      />

      <div className="border-t pt-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">未所属の画像</h2>
          <LibraryImageUploader />
        </div>

        <ComponentAsyncBoundary componentName="UnassignedImages">
          <UnassignedImageContainer />
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
  );
};