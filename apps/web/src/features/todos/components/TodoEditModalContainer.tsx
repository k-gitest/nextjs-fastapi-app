import { useTodo } from "../hooks/useTodo";
import { useCallback } from "react";
import { TodoEditModal } from "./TodoEditModal";
import type { TodoWithImages } from "../types";
import type { TodoFormValues } from "../schemas";
import type { ImageInput } from "@/features/images/schemas";

export const TodoEditModalContainer = ({ todo, onClose }: { todo: TodoWithImages; onClose: () => void }) => {
  const { updateTodo } = useTodo();

  // NOTE: useTodo().updateTodo の実際のシグネチャを確認できていません。
  // 現状は { id, ...values } の形でRoute Handlerへ渡している前提のため、
  // image を同様に渡せるよう拡張されている想定で書いています。
  // 実際のフックの中身と合わない場合は調整が必要です。
  const handleSubmit = useCallback(
    async (values: TodoFormValues, image: ImageInput) => {
      await updateTodo({ id: todo.id, ...values, image });
      onClose();
    },
    [todo.id, updateTodo, onClose],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  const existingImage = todo.images[0]
    ? { id: todo.images[0].id, originalFileName: todo.images[0].originalFileName }
    : null;

  return (
    <TodoEditModal
      title={todo.todo_title}
      priority={todo.priority ?? "MEDIUM"}
      progress={todo.progress ?? 0}
      existingImage={existingImage}
      open={true}
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit}
    />
  );
};