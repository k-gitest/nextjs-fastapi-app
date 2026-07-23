import { useTodo } from "../hooks/useTodo";
import { useCallback } from "react";
import { TodoEditModal } from "./TodoEditModal";
import type { TodoWithImages } from "../types";
import type { TodoFormValues } from "../schemas";
import type { ImageListInput } from "@/features/images/schemas";
import type { ExistingImageSource } from "@/features/images/hooks/useImageList";

export const TodoEditModalContainer = ({ todo, onClose }: { todo: TodoWithImages; onClose: () => void }) => {
  const { updateTodo, updateMutation } = useTodo();

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