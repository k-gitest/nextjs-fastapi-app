"use client";

import { useState, useCallback } from "react";
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
import { ImageUploader } from "@/features/images/components/ImageUploader";
import type { AttachImageInput, ImageInput } from "@/features/images/schemas";

interface ExistingImage {
  id: string;
  originalFileName: string;
}

interface TodoEditModalProps {
  title: string;
  priority: Priority;
  progress: number;
  existingImage?: ExistingImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 画像の変更（undefined=変更なし/null=削除/object=添付・差し替え）を第2引数として渡す
  onSubmit: (values: TodoFormValues, image: ImageInput) => Promise<void>;
  isSubmitting?: boolean;
}

export const TodoEditModal = ({
  title,
  priority,
  progress,
  existingImage,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: TodoEditModalProps) => {
  // TodoForm（react-hook-form）とは別に、画像はDialog層でローカル状態として保持する
  // TodoForm自体は画像を一切知らない
  const [image, setImage] = useState<AttachImageInput | null | undefined>(
    undefined,
  );

  const handleSubmit = async (values: TodoFormValues) => {
    await onSubmit(values, image);
    setImage(undefined); // 保存成功後、次回開いたときのために状態をリセット
  };

  // Dialogを閉じたとき（キャンセル含む）も画像状態をリセットする
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setImage(undefined);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>タスクを編集</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          タスクの情報を編集してください。
        </DialogDescription>

        <ImageUploader
          existingImage={existingImage}
          value={image}
          onChange={setImage}
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
          submitLabel={isSubmitting ? "保存中..." : "変更を保存"}
        />
      </DialogContent>
    </Dialog>
  );
};
