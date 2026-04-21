"use client";

import { useQuery } from "@tanstack/react-query";

export interface SimilarTodoItem {
  id: string;
  score: number;
  title: string;
  priority?: string;
  progress?: number;
}

export interface SimilarTodosResponse {
  results: SimilarTodoItem[];
  count: number;
  query: string;
}

const fetchSimilarTodos = async (
  query: string,
  topK = 5,
  minScore = 0.5
): Promise<SimilarTodosResponse> => {
  const params = new URLSearchParams({
    q: query,
    top_k: String(topK),
    min_score: String(minScore),
  });

  const res = await fetch(`/api/todos/search?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail ?? "検索に失敗しました");
  }
  return res.json();
};

interface UseTodoSearchOptions {
  topK?: number;
  minScore?: number;
  /** trueの場合のみ検索を実行（デフォルト: queryが空でない場合に実行）*/
  enabled?: boolean;
}

/**
 * セマンティック検索フック
 *
 * - queryが空の場合は検索しない
 * - 300msのdebounceはコンポーネント側で実装する
 * - staleTime: 30秒（同じクエリの再検索を抑制）
 *
 * 使用例:
 *   const { data, isLoading, error } = useTodoSearch("会議関連");
 */
export const useTodoSearch = (
  query: string,
  options: UseTodoSearchOptions = {}
) => {
  const { topK = 5, minScore = 0.5, enabled } = options;

  const isEnabled =
    enabled !== undefined ? enabled : query.trim().length > 0;

  return useQuery<SimilarTodosResponse, Error>({
    queryKey: ["todos", "search", query, topK, minScore],
    queryFn: () => fetchSimilarTodos(query, topK, minScore),
    enabled: isEnabled,
    staleTime: 1000 * 30, // 30秒（同じクエリは再取得しない）
    retry: false, // 検索エラーはリトライしない
  });
};