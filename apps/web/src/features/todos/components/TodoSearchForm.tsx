"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
// import { useTodoSearch } from "../hooks/useTodoSearch";
//import type { SimilarTodoItem } from "../hooks/useTodoSearch";
import { useTodoSearchState } from "../hooks/useTodoSearchState";

/*
interface TodoSearchFormProps {
  // 検索結果のTodoをクリックした時のコールバック
  onSelectTodo?: (todo: SimilarTodoItem) => void;
}
*/

/**
 * セマンティック検索フォーム
 *
 * - 300msのdebounceで検索を実行
 * - 検索結果をドロップダウンで表示
 */
export const TodoSearchForm = () => {
  const [inputValue, setInputValue] = useState("");
  // const [debouncedQuery, setDebouncedQuery] = useState("");
  const setSearchQuery = useTodoSearchState((state) => state.setSearchQuery);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchQuery]);

  /*
  const { data, isLoading, error } = useTodoSearch(debouncedQuery);

  const handleSelect = useCallback(
    (todo: SimilarTodoItem) => {
      onSelectTodo?.(todo);
      setInputValue("");
      setDebouncedQuery("");
    },
    [onSelectTodo]
  );
  */

  /*
  return (
    <div className="relative w-full">

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="タスクをセマンティック検索..."
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>


      {debouncedQuery && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
          {error && (
            <p className="px-3 py-2 text-sm text-destructive">
              検索に失敗しました
            </p>
          )}

          {!isLoading && data?.results.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              「{debouncedQuery}」に一致するタスクが見つかりません
            </p>
          )}

          {data?.results.map((todo) => (
            <button
              key={todo.id}
              onClick={() => handleSelect(todo)}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">
                  {todo.title}
                </span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {Math.round(todo.score * 100)}% 一致
                </span>
              </div>
              {(todo.priority || todo.progress !== undefined) && (
                <div className="flex gap-2 mt-0.5">
                  {todo.priority && (
                    <span className="text-xs text-muted-foreground">
                      {todo.priority}
                    </span>
                  )}
                  {todo.progress !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      進捗 {todo.progress}%
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  */

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="タスクを意味で検索 (例: 急ぎの仕事)..."
        className="pl-9 pr-9"
      />
      {inputValue && (
        <button 
          onClick={() => setInputValue("")}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
};