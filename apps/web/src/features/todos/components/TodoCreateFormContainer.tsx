"use client";

import { useCallback } from "react";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { useExclusiveModal, useUIStore } from "@/hooks/useExclusiveModal";
import { TodoCreateForm } from "./TodoCreateForm";
import type { TodoFormValues } from "@/features/todos/schemas";
import type { ImageListInput } from "@/features/images/schemas";

export const TodoCreateFormContainer = () => {
  const { createTodo, createMutation } = useTodo();
  const { isOpen, open, close } = useExclusiveModal();

  const handleCreateSubmit = useCallback(
    async (values: TodoFormValues, images: ImageListInput, albumId: string | null) => {
      try {
        await createTodo({ ...values, images, albumId });
      } catch (error) {
        if (process.env.DEV) console.error(error);
        throw error;
      }
    },
    [createTodo],
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        open();
      } else {
        close();
      }
    },
    [open, close],
  );

  const isLockedByOther = useUIStore((state) => state.currentModalId !== null && !isOpen);

  return (
    <TodoCreateForm
      open={isOpen}
      onOpenChange={handleOpenChange}
      onSubmit={handleCreateSubmit}
      isLoading={createMutation.isPending}
      disabled={isLockedByOther}
    />
  );
};