import { useCallback } from 'react';
import { useExclusiveModal, useUIStore } from '@/hooks/useExclusiveModal';
import { useUpdateTodo } from '../hooks/useUpdateTodo';
import { useDeleteTodo } from '../hooks/useDeleteTodo';
import type { TodoListFilters, TodoWithImageSummaries } from '../types';
import { DEFAULT_TODO_FILTERS } from '../types';
import type { SimilarTodoItem } from '../hooks/useTodoSearch';
import { TodoEditModalContainer } from './TodoEditModalContainer';
import { TodoItem } from './TodoItem';

interface TodoItemContainerProps {
  todo: TodoWithImageSummaries | SimilarTodoItem;
  // 一覧の現在の表示条件。楽観的更新（useUpdateTodo/useDeleteTodo）が
  // どのfiltersキャッシュを直接書き換えるかを決定するために必要。
  // 検索モードでは操作自体が無効（showActions=false）のため未指定でも問題ない。
  filters?: TodoListFilters;
  isSearchMode?: boolean;
  score?: number;
}

export const TodoItemContainer = ({
  todo,
  filters = DEFAULT_TODO_FILTERS,
  isSearchMode,
  score,
}: TodoItemContainerProps) => {
  const updateMutation = useUpdateTodo(filters);
  const deleteMutation = useDeleteTodo(filters);
  const { isOpen, open, close } = useExclusiveModal();

  const isFullTodo = "todo_title" in todo;

  const title = isFullTodo ? todo.todo_title : todo.title;
  const updatedAt = isFullTodo ? todo.updatedAt : undefined;

  const handleToggleComplete = useCallback(async () => {
    if (!isFullTodo) return;
    const newProgress = todo.progress === 100 ? 0 : 100;
    await updateMutation.mutateAsync({ id: String(todo.id), progress: newProgress });
  }, [isFullTodo, todo.id, todo.progress, updateMutation]);

  const handleEdit = open;

  const handleDelete = useCallback(async () => {
    if (!isFullTodo) return;
    if (window.confirm('本当にこのタスクを削除しますか？')) {
      await deleteMutation.mutateAsync(todo.id);
    }
  }, [isFullTodo, todo.id, deleteMutation]);

  const isLockedByOther = useUIStore(
    (state) => state.currentModalId !== null && !isOpen
  );

  const isDisabled = isFullTodo
    ? (updateMutation.isPending || deleteMutation.isPending || isLockedByOther)
    : false;

  return (
    <>
      <TodoItem
        id={todo.id}
        title={title}
        priority={(todo.priority as "LOW" | "MEDIUM" | "HIGH") ?? 'MEDIUM'}
        progress={todo.progress ?? 0}
        updatedAt={updatedAt}
        showActions={isFullTodo && !isSearchMode}
        onToggleComplete={handleToggleComplete}
        disabled={isDisabled}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isSearchMode={isSearchMode}
        score={score}
      />
      {isOpen && isFullTodo && (
        <TodoEditModalContainer
          todo={todo}
          filters={filters}
          onClose={close}
        />
      )}
    </>
  );
};