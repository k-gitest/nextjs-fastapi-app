"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useTodoSearchState } from "../hooks/useTodoSearchState";

/**
 * セマンティック検索フォーム
 *
 * - 300msのdebounceで検索を実行
 * - 検索結果をドロップダウンで表示
 */
export const TodoSearchForm = () => {
  const [inputValue, setInputValue] = useState("");
  const setSearchQuery = useTodoSearchState((state) => state.setSearchQuery);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchQuery]);

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id="todo-search"
        name="todo-search"
        autoComplete="off"
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