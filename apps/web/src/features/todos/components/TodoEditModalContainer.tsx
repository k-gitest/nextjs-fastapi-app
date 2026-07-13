import { useTodo } from "../hooks/useTodo";
import { useCallback } from "react";
import { TodoEditModal } from "./TodoEditModal";
import type { TodoWithImages } from "../types";
import type { TodoFormValues } from "../schemas";
import type { ImageListInput } from "@/features/images/schemas";
import type { ExistingImageSource } from "@/features/images/hooks/useImageList";

export const TodoEditModalContainer = ({ todo, onClose }: { todo: TodoWithImages; onClose: () => void }) => {
  const { updateTodo, updateMutation } = useTodo();

  // NOTE: ここでは onClose() を直接呼ばない。
  // 保存成功後に閉じる処理は TodoEditModal 内の TodoEditModalBody が
  // onSuccess()（= onOpenChange(false) 経由でこの handleOpenChange → onClose()）
  // を呼ぶことで行われる。ここでも onClose() を呼ぶと、
  // 「Container側の直接呼び出し」と「onOpenChange経由の呼び出し」で
  // onClose() が二重に実行されてしまう。
  const handleSubmit = useCallback(
    async (values: TodoFormValues, images: ImageListInput) => {
      await updateTodo({ id: todo.id, ...values, images });
    },
    [todo.id, updateTodo],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  // useImageList(initialImages) 用の最小構成に変換する。
  // ImageUploadSlot/ImageGalleryはoriginalFileNameやcreatedAtを表示しないため、
  // ExistingImageSource（id/fileSize/order）以外のフィールドは不要。
  const existingImages: ExistingImageSource[] = todo.images.map((image) => ({
    id: image.id,
    fileSize: image.fileSize,
    order: image.order,
  }));

  return (
    <TodoEditModal
      title={todo.todo_title}
      priority={todo.priority ?? "MEDIUM"}
      progress={todo.progress ?? 0}
      existingImages={existingImages}
      open={true}
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit}
      isSubmitting={updateMutation.isPending}
    />
  );
};