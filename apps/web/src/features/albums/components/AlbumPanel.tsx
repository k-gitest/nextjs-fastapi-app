"use client";

import { useState } from "react";
import { AlbumList } from "./AlbumList";
import { AlbumCreateDialog } from "./AlbumCreateDialog";
import { AlbumEditDialog } from "./AlbumEditDialog";
import { useAlbums } from "../hooks/useAlbums";
import { useCreateAlbum } from "../hooks/useCreateAlbum";
import { useUpdateAlbum } from "../hooks/useUpdateAlbum";
import { useDeleteAlbum } from "../hooks/useDeleteAlbum";
import type { Album } from "../types";

/**
 * Album CRUD一式をまとめたパネル。
 *
 * Phase3-3時点ではContainer/Presentationalを分離せず、
 * このコンポーネント自体がContainer相当の責務（hooks呼び出し）を持つ
 * （YAGNI。必要になれば後からAlbumPanelContainerへ分離できる構成にしてある）。
 *
 * 独立コンポーネントのため、現在は既存の/todoページ内に配置する暫定運用だが、
 * 将来専用ページ（/album等）が必要になった場合もそのまま移設できる。
 */
export const AlbumPanel = () => {
  const { albums } = useAlbums();
  const createMutation = useCreateAlbum();
  const updateMutation = useUpdateAlbum();
  const deleteMutation = useDeleteAlbum();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleDelete = (album: Album) => {
    // Image.albumIdはonDelete: Restrictのため、画像が残っている場合はサービス層でP2003を
    // 捕捉しConflictError(409)へ変換している。ここでは事前確認を行わずそのまま呼び出し、
    // 失敗時はerrorHandler経由で「画像が存在するアルバムは削除できません」がトースト表示される。
    deleteMutation.mutate(album.id);
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

      <AlbumList albums={albums} onEdit={setEditingAlbum} onDelete={handleDelete} disabled={isMutating} />

      <AlbumEditDialog
        album={editingAlbum}
        onOpenChange={(open) => {
          if (!open) setEditingAlbum(null);
        }}
        onSubmit={async (values) => {
          if (!editingAlbum) return;
          await updateMutation.mutateAsync({ id: editingAlbum.id, name: values.name });
        }}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
};