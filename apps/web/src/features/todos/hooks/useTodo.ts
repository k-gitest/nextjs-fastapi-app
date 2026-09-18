"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { TodoWithImageSummaries } from "../types";
import { fetchTodos } from "./todoApi";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";

export const useTodo = () => {
  const { data } = useApiSuspenseQuery<TodoWithImageSummaries[]>({
    queryKey: TODO_QUERY_KEY,
    queryFn: fetchTodos,
    staleTime: 1000 * 5,
  });

  return { todos: data };
};