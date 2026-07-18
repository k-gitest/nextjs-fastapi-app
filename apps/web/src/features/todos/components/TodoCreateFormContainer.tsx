"use client";

import { useCallback } from "react";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { useExclusiveModal, useUIStore } from "@/hooks/useExclusiveModal";
import { TodoCreateForm } from "./TodoCreateForm";
import type { TodoFormValues } from "@/features/todos/schemas";
import type { CreateImageListInput } from "@/features/images/schemas";

export const TodoCreateFormContainer = () => {
  const { createTodo, createMutation } = useTodo();
  const { isOpen, open, close } = useExclusiveModal();

  // NOTE: ここでは close() を直接呼ばない。
  // 保存成功後に閉じる処理は TodoCreateForm 内の TodoCreateFormBody が
  // onSuccess()（= onOpenChange(false) 経由でこの handleOpenChange → close()）
  // を呼ぶことで行われる。ここでも close() を呼ぶと、
  // 「Container側の直接呼び出し」と「onOpenChange経由の呼び出し」で
  // close() が二重に実行されてしまう。
  const handleCreateSubmit = useCallback(
    async (values: TodoFormValues, images: CreateImageListInput, albumId: string | null) => {
      try {
        await createTodo({ ...values, images, albumId });
      } catch (error) {
        // ❌ エラー時は開いたまま
        if (process.env.DEV) console.error(error);
        // オプション: エラー通知
        // toast.error('作成に失敗しました。もう一度お試しください。');
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
        close(); // ユーザーが「キャンセル」ボタンで閉じた場合
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