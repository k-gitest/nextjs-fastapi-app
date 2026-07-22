"use client";

import { useState } from "react";
import { Priority } from "@repo/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TodoFormValues } from "../schemas";
import { TodoForm } from "./TodoForm";
import { ImageGallery } from "@/features/images/components/ImageGallery";
import {
  useImageList,
  type ExistingImageSource,
} from "@/features/images/hooks/useImageList";
import type { ImageListInput } from "@/features/images/schemas";
import { AlbumSelector } from "@/features/albums/components/AlbumSelector";
import { useAlbums } from "@/features/albums/hooks/useAlbums";

interface TodoEditModalProps {
  title: string;
  priority: Priority;
  progress: number;
  // 画像0枚のTodoも許容するため任意とし、未指定時は空配列扱いにする
  // （useImageListのinitialImagesデフォルト値との一貫性を保つ）。
  existingImages?: ExistingImageSource[];
  // 現在このTodoに添付されている画像のalbumId
  // （TodoEditModalContainer側でtodo.images[0]?.albumId ?? nullを渡す想定）。
  // 画像0枚の場合や、既存画像に明示的なAlbumが設定されていない場合はnull。
  existingAlbumId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 画像（保存後の最終状態のスナップショット）とalbumId（Todo単位で選択したAlbum）を渡す
  onSubmit: (
    values: TodoFormValues,
    images: ImageListInput,
    albumId: string | null,
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export const TodoEditModal = ({
  title,
  priority,
  progress,
  existingImages = [],
  existingAlbumId = null,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: TodoEditModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>タスクを編集</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          タスクの情報を編集してください。
        </DialogDescription>

        {/*
          TodoCreateFormと同じ契約。open状態が変わるたびにBodyを丸ごと
          アンマウント/再マウントし、useImageListの状態（items等）・Album選択状態を初期化する。
          TodoEditModalContainer側で条件レンダリングによりモーダルごと
          アンマウントされる実装であっても、このkeyがあることで
          「Dialogの開閉時にBodyが必ず再初期化される」という契約が
          このコンポーネント単体で保証される（親の実装詳細に依存しない）。
          Dialog/DialogContent自体にはkeyを付けない。
        */}
        <TodoEditModalBody
          key={open ? "dialog-open" : "dialog-closed"}
          title={title}
          priority={priority}
          progress={progress}
          existingImages={existingImages}
          existingAlbumId={existingAlbumId}
          onSubmit={onSubmit}
          onSuccess={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

type TodoEditModalBodyProps = {
  title: string;
  priority: Priority;
  progress: number;
  existingImages: ExistingImageSource[];
  existingAlbumId: string | null;
  onSubmit: (
    values: TodoFormValues,
    images: ImageListInput,
    albumId: string | null,
  ) => Promise<void>;
  onSuccess: () => void;
  isSubmitting?: boolean;
};

/**
 * useImageList・ImageGallery・AlbumSelector・TodoFormをまとめたフォーム本体。
 * TodoEditModalからkey付きで描画されることで、Dialogの開閉ごとに
 * useImageListの状態・Album選択状態を含めてまるごと初期化される
 * （useImageList自体にreset()は持たせず、再マウントによる初期化に統一している）。
 *
 * useAlbums()はAlbumPanel（TodoIndex内に常設）が既にページ表示時にfetch済みのため、
 * ここではTanStack Queryのキャッシュから即座に解決される想定。
 */
const TodoEditModalBody = ({
  title,
  priority,
  progress,
  existingImages,
  existingAlbumId,
  onSubmit,
  onSuccess,
  isSubmitting,
}: TodoEditModalBodyProps) => {
  const imageList = useImageList(existingImages);
  const { albums } = useAlbums();
  // albumOverride: ユーザーが明示的にAlbumSelectorを操作した場合のみ値が入る。
  // undefined = まだ触れていない。
  //
  // 優先順位: albumOverride（ユーザー操作） > existingAlbumId（既存画像のAlbum） >
  // albums[0]（displayOrder最小） > null。
  // albumsは後から非同期に反映されうるため、useEffectでの同期ではなく
  // レンダーのたびに導出する（＝useEffectが不要な派生値）。
  const [albumOverride, setAlbumOverride] = useState<string | null | undefined>(
    undefined,
  );
  const albumId =
    albumOverride !== undefined
      ? albumOverride
      : (existingAlbumId ?? albums[0]?.id ?? null);

  const handleSubmit = async (values: TodoFormValues) => {
    if (!imageList.canSave) {
      return;
    }
    await onSubmit(values, imageList.toImageIds(), albumId);
    onSuccess();
  };

  return (
    <>
      <AlbumSelector
        albums={albums}
        value={albumId}
        onChange={setAlbumOverride}
        disabled={isSubmitting}
      />

      <ImageGallery
        items={imageList.items}
        addFiles={imageList.addFiles}
        removeItem={imageList.removeItem}
        disabled={isSubmitting}
      />

      <TodoForm
        defaultValues={{
          todo_title: title,
          priority: priority,
          progress: progress,
        }}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        disabled={isSubmitting || !imageList.canSave}
        submitLabel="変更を保存"
      />
    </>
  );
};
