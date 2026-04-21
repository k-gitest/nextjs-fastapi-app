"use client"

import { useCallback } from 'react';
import { useTodo } from '@/features/todos/hooks/useTodo';
import { useExclusiveModal, useUIStore } from '@/hooks/useExclusiveModal';
import { TodoCreateForm } from './TodoCreateForm';
import type { TodoFormValues } from '@/features/todos/schemas';

export const TodoCreateFormContainer = () => {
  const { createTodo, createMutation } = useTodo();
  const { isOpen, open, close } = useExclusiveModal();

  const handleCreateSubmit = useCallback(async (values: TodoFormValues) => {
    try {
      await createTodo(values);
      close(); // ✅ 成功時のみ閉じる
    } catch (error) {
      // ❌ エラー時は開いたまま
      if (process.env.DEV) console.error(error);
      // オプション: エラー通知
      // toast.error('作成に失敗しました。もう一度お試しください。');
      throw error;
    }
  }, [createTodo, close]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    console.log("onOpenChange called with:", newOpen);
    if (newOpen) {
      open();
    } else {
      close(); // ユーザーが「キャンセル」ボタンで閉じた場合
    }
  }, [open, close]);

  const isLockedByOther = useUIStore(
    (state) => state.currentModalId !== null && !isOpen
  );

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