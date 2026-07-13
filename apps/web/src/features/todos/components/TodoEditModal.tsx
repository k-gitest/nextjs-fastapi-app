"use client";

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
import { useImageList, type ExistingImageSource } from "@/features/images/hooks/useImageList";
import type { ImageListInput } from "@/features/images/schemas";

interface TodoEditModalProps {
  title: string;
  priority: Priority;
  progress: number;
  // 画像0枚のTodoも許容するため任意とし、未指定時は空配列扱いにする
  // （useImageListのinitialImagesデフォルト値との一貫性を保つ）。
  existingImages?: ExistingImageSource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 画像（保存後の最終状態のスナップショット）を第2引数として渡す
  onSubmit: (values: TodoFormValues, images: ImageListInput) => Promise<void>;
  isSubmitting?: boolean;
}

export const TodoEditModal = ({
  title,
  priority,
  progress,
  existingImages = [],
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
          アンマウント/再マウントし、useImageListの状態（items等）を初期化する。
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
  onSubmit: (values: TodoFormValues, images: ImageListInput) => Promise<void>;
  onSuccess: () => void;
  isSubmitting?: boolean;
};

/**
 * useImageList・ImageGallery・TodoFormをまとめたフォーム本体。
 * TodoEditModalからkey付きで描画されることで、Dialogの開閉ごとに
 * useImageListの状態を含めてまるごと初期化される
 * （useImageList自体にreset()は持たせず、再マウントによる初期化に統一している）。
 */
const TodoEditModalBody = ({
  title,
  priority,
  progress,
  existingImages,
  onSubmit,
  onSuccess,
  isSubmitting,
}: TodoEditModalBodyProps) => {
  const imageList = useImageList(existingImages);

  const handleSubmit = async (values: TodoFormValues) => {
    // TodoForm側のisLoading連動によるボタンdisabledでも防いでいるが、
    // 二重防御としてここでも確認する（アップロード中・エラー残存時は送信しない）。
    if (!imageList.canSave) {
      return;
    }
    await onSubmit(values, imageList.toImageListInput());
    onSuccess();
  };

  return (
    <>
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
        // NOTE: TodoCreateForm.tsx と同じ制約。TodoForm.tsx は disabled と
        // loading（表示文言）を分離していないため、アップロード中・エラー残存時も
        // 「保存中...」表示になる（意味的にはやや不正確）。今回はTodoForm.tsx自体の
        // 改修をスコープ外とした。将来的な改善余地として記録しておく。
        isLoading={isSubmitting || !imageList.canSave}
        submitLabel={isSubmitting ? "保存中..." : "変更を保存"}
      />
    </>
  );
};