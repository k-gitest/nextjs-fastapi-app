"use client";

import { useState, useTransition } from "react";
import { useTodo } from "../hooks/useTodo";
import { useTodoSearch } from "../hooks/useTodoSearch";
import { useTodoSearchState } from "../hooks/useTodoSearchState";
import { TodoItem } from "./TodoItem";
import { TodoItemContainer } from "./TodoItemContainer";
import { TodoSortFilterControls } from "./TodoSortFilterControls";
import type { TodoListFilters, TodoWithImageSummaries } from "../types";
import { DEFAULT_TODO_FILTERS } from "../types";
import { Loader2, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const TodoListContainer = ({
  showActions = true,
  limit,
}: {
  showActions?: boolean;
  limit?: number;
}) => {
  const [filters, setFilters] = useState<TodoListFilters>(DEFAULT_TODO_FILTERS);
  // フィルタ変更によるqueryKey切り替え時、useSuspenseQueryの再サスペンドを
  // startTransitionでラップすることでSuspense fallbackへの切り替えを抑制する。
  // 初回マウント時のサスペンド（トランジション外）は従来どおりAsyncBoundaryの
  // fallbackが表示される。isPendingはTodoSortFilterControls側の見た目の
  // フィードバック用に渡す。
  const [isPending, startTransition] = useTransition();
  const { todos } = useTodo(filters);

  const handleFiltersChange = (next: TodoListFilters) => {
    startTransition(() => {
      setFilters(next);
    });
  };

  // すでにフック側で todos は配列であることが保証されているので、これだけでOK
  const safeTodos: TodoWithImageSummaries[] = Array.isArray(todos) ? todos : [];

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
            filters={filters}
            isSearchMode={true}
            score={todo.score}
          />
        ))}
      </div>
    );
  }

  // 🔽 通常モードのレンダリング
  return (
    <div className="space-y-4">
      {showActions && (
        <TodoSortFilterControls
          filters={filters}
          onChange={handleFiltersChange}
          isPending={isPending}
        />
      )}

      {safeTodos.length === 0 ? (
        <p className="text-center text-gray-500">
          タスクが見つかりません。
        </p>
      ) : (
        displayTodos.map((todo) =>
          showActions ? (
            <TodoItemContainer key={todo.id} todo={todo} filters={filters} />
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
        )
      )}
    </div>
  );
};