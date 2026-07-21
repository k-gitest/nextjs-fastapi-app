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
import { AlbumDetailContainer } from "./AlbumDetailContainer";
import { useAlbums } from "../hooks/useAlbums";
import { useCreateAlbum } from "../hooks/useCreateAlbum";
import { useUpdateAlbum } from "../hooks/useUpdateAlbum";
import { useDeleteAlbum } from "../hooks/useDeleteAlbum";
import type { Album } from "../types";

/**
 * Album CRUD + 選択中Album詳細表示をまとめたパネル。
 * /albumsページに配置する（旧: /todoページに暫定配置していたものを移設）。
 *
 * selectedAlbumIdはこのコンポーネントが状態を持つ。選択されたAlbumの詳細は
 * AlbumDetailContainerが担当し、useAlbumDetail（Suspenseクエリ）の読み込み中は
 * 一覧・CRUD部分を巻き込まないよう ComponentAsyncBoundary で個別に囲む。
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
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const handleConfirmDelete = () => {
    if (!deletingAlbum) return;
    const targetId = deletingAlbum.id;
    const wasSelected = targetId === selectedAlbumId;

    // 選択中Albumを削除する場合、削除確定と同時に選択解除する。
    // useDeleteAlbum内のinvalidateQueries(["albums"])はprefix matchで
    // ["albums", targetId]（AlbumDetailContainerが使うクエリ）も対象になるため、
    // Mutation成功後に選択解除するとAlbumDetailContainerがまだマウントされたまま
    // 再フェッチが走り、削除済みAlbumへの404が発生する。
    // そのため、Mutation開始前（＝ここ）で先に選択解除し、AlbumDetailContainerを
    // アンマウントしてからinvalidateQueriesが走るようにする。
    // 失敗時はonErrorで選択状態を復元する。
    if (wasSelected) {
      setSelectedAlbumId(null);
    }

    deleteMutation.mutate(targetId, {
      onSuccess: () => {
        if (targetId === selectedAlbumId) {
          setSelectedAlbumId(null);
        }
        setDeletingAlbum(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">アルバム管理</h3>
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
        onSelect={(album) => setSelectedAlbumId(album.id)}
        selectedAlbumId={selectedAlbumId}
        disabled={isMutating}
      />

      <div className="border-t pt-4 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">未所属の画像</h3>
          <LibraryImageUploader />
        </div>
        <ComponentAsyncBoundary componentName="UnassignedImages">
          <UnassignedImageContainer />
        </ComponentAsyncBoundary>
      </div>

      {selectedAlbumId && (
        <div className="bg-muted/50 rounded-lg border p-4">
          <ComponentAsyncBoundary componentName="AlbumDetail">
            <AlbumDetailContainer albumId={selectedAlbumId} />
          </ComponentAsyncBoundary>
        </div>
      )}

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
