"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { TodoListFilters, TodoWithImageSummaries } from "../types";
import { DEFAULT_TODO_FILTERS } from "../types";
import { fetchTodos } from "./todoApi";
import { todoQueryKey } from "@/features/todos/lib/queryKeys";

export const useTodo = (filters: TodoListFilters = DEFAULT_TODO_FILTERS) => {
  const { data } = useApiSuspenseQuery<TodoWithImageSummaries[]>({
    queryKey: todoQueryKey(filters),
    queryFn: () => fetchTodos(filters),
    staleTime: 1000 * 5,
  });

  return { todos: data };
};