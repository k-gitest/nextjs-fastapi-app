"use client";

import { useTodo } from "../hooks/useTodo";
import { useTodoSearch } from "../hooks/useTodoSearch";
import { useTodoSearchState } from "../hooks/useTodoSearchState";
import { TodoItem } from "./TodoItem";
import { TodoItemContainer } from "./TodoItemContainer";
//import { useState, useCallback } from 'react';
//import { TodoEditModal } from './TodoEditModal';
import type { Todo } from "../types";
//import type { TodoFormValues } from '../schemas';
import { Loader2, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const TodoList = ({
  showActions = true,
  limit,
}: {
  showActions?: boolean;
  limit?: number;
}) => {
  const { todos } = useTodo();
  //const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  /*
  const handleToggleComplete = useCallback(async (id: number | string, currentProgress: number) => {
    const newProgress = currentProgress === 100 ? 0 : 100;
    await updateTodo({ id: Number(id), progress: newProgress });
  }, [updateTodo]);

  const handleEdit = useCallback((todo: Todo) => {
    setEditingTodo(todo);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (window.confirm('本当にこのタスクを削除しますか？')) {
      await deleteTodo(id);
    }
  }, [deleteTodo]);

  const handleUpdateSubmit = useCallback(async (values: TodoFormValues) => {
    if (!editingTodo) return;
    await updateTodo({ id: editingTodo.id, ...values });
  }, [editingTodo, updateTodo]);

  const handleModalClose = useCallback((open: boolean) => {
    if (!open) {
      setEditingTodo(null);
    }
  }, []);
  */

  // APIレスポンスが「配列そのまま」の場合と「{ data: [] }」の場合を許容し、
  // 取得失敗時は空配列をデフォルトにする（データの正規化）
  // const safeTodos: Todo[] = Array.isArray(todos) ? todos : (todos?.data ?? []);
  // すでにフック側で todos は配列であることが保証されているので、これだけでOK
  const safeTodos: Todo[] = Array.isArray(todos) ? todos : [];

  // もしフック側の型定義を完全に信頼するなら、これだけでも動きます
  // const safeTodos = todos;

  const displayTodos = limit ? safeTodos.slice(0, limit) : safeTodos;

  // 検索状態の取得
  const { searchQuery, setSearchQuery } = useTodoSearchState();
  const isSearchMode = searchQuery.trim().length >= 2;

  const {
    data: searchData,
    isLoading: isSearchLoading,
    isError: isSearchError
  } = useTodoSearch(searchQuery);

  // 🔽 検索モードのレンダリング
  if (isSearchMode) {
    return (
      <div className="space-y-4">
        {/* 検索ステータスヘッダー */}
        <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>「{searchQuery}」の関連タスク</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
            <X className="h-4 w-4 mr-1" /> クリア
          </Button>
        </div>

        {/* エラー表示 */}
        {isSearchError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>検索中にエラーが発生しました。</AlertDescription>
          </Alert>
        )}

        {/* ローディング表示 (初回のみ) */}
        {isSearchLoading && !searchData && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 検索結果ゼロの場合 */}
        {searchData?.results.length === 0 && !isSearchLoading && (
          <p className="text-center text-muted-foreground py-8">
            一致するタスクが見つかりません。
          </p>
        )}

        {/* 検索結果の表示 */}
        {searchData?.results.map((todo) => (
          // ⚠️注意: SimilarTodoItem を TodoItemContainer に渡すため、
          // 必要に応じて TodoItemContainer 側の型定義やPropを調整してください
          <TodoItemContainer
            key={todo.id}
            todo={todo}
            isSearchMode={true}
            score={todo.score}
          />
        ))}
      </div>
    );
  }

  // 🔽 通常モードのレンダリング (元のロジックをそのまま使用)
  if (safeTodos.length === 0) {
    return (
      <p className="text-center text-gray-500">
        まだタスクがありません。新しいタスクを追加しましょう！
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {displayTodos.map((todo) =>
        showActions ? (
          <TodoItemContainer key={todo.id} todo={todo} />
        ) : (
          <TodoItem
            key={todo.id}
            id={todo.id}
            title={todo.todo_title}
            priority={todo.priority ?? "MEDIUM"}
            progress={todo.progress ?? 0}
            updatedAt={todo.updatedAt}
            showActions={false}
          />
        ),
      )}
    </div>
  );
};
