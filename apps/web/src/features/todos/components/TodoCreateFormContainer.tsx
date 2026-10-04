"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useCreateTodo } from "@/features/todos/hooks/useCreateTodo";
import { useExclusiveModal, useUIStore } from "@/hooks/useExclusiveModal";
import { TodoCreateForm } from "./TodoCreateForm";
import type { TodoFormValues } from "@/features/todos/schemas";
import type { ImageListInput } from "@/features/images/schemas";

// SSRでは無効化し、hydration完了後に操作可能にする。
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true; // hydration後・クライアント遷移時
const getServerSnapshot = () => false; // SSR・hydration中

export const TodoCreateFormContainer = () => {
  const createMutation = useCreateTodo();
  const { isOpen, open, close } = useExclusiveModal();

  const isReady = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );

  const handleCreateSubmit = useCallback(
    async (values: TodoFormValues, images: ImageListInput) => {
      try {
        await createMutation.mutateAsync({ ...values, images });
      } catch (error) {
        if (process.env.DEV) console.error(error);
        throw error;
      }
    },
    [createMutation],
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

  const isLockedByOther = useUIStore(
    (state) => state.currentModalId !== null && !isOpen,
  );

  return (
    <TodoCreateForm
      open={isOpen}
      onOpenChange={handleOpenChange}
      onSubmit={handleCreateSubmit}
      isLoading={createMutation.isPending}
      disabled={!isReady || isLockedByOther}
    />
  );
};