"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useTanstackQuery";
import type { Todo, CreateTodoInput } from "../types";
import { Priority } from "@repo/db";
import { ApiError } from "@/errors/api-error";

export const TODO_QUERY_KEY = ["todos"] as const;

// フロントからは userId を送らない（Route Handler側で付与する）ため Omit する
type CreateTodoReq = Omit<CreateTodoInput, "userId">;

// 型定義
/*
type CreateTodoReq = {
  todo_title: string;
  priority?: "HIGH" | "MEDIUM" | "LOW";
  progress?: number;
};
*/

type UpdateTodoReq = {
  id: string;
  todo_title?: string;
  priority?: Priority;
  progress?: number;
};

// Route Handler経由のfetch関数
const fetchTodos = (): Promise<Todo[]> =>
  fetch("/api/todos").then((res) => {
    if (!res.ok) throw new Error("Failed to fetch todos");
    return res.json();
  });

const createTodoFetch = (data: CreateTodoReq): Promise<Todo> =>
  fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => {
    if (!res.ok) throw new Error("Failed to create todo");
    return res.json();
  });

const updateTodoFetch = ({ id, ...data }: UpdateTodoReq): Promise<Todo> =>
  fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => {
    if (!res.ok) throw new Error("Failed to update todo");
    return res.json();
  });

const deleteTodoFetch = (id: string): Promise<void> =>
  fetch(`/api/todos/${id}`, { method: "DELETE" }).then((res) => {
    if (!res.ok) throw new Error("Failed to delete todo");
  });

export const useTodo = () => {
  const queryClient = useQueryClient();

  // 一覧取得（Suspense）
  const todosQuery = useSuspenseQuery<Todo[]>({
    queryKey: TODO_QUERY_KEY,
    queryFn: fetchTodos,
    staleTime: 1000 * 5,
  });

  // 作成
  const createMutation = useApiMutation<
    Todo,
    Error | ApiError,
    CreateTodoReq,
    { previousTodos: Todo[] | undefined }
  >({
    mutationFn: createTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<Todo[]>(TODO_QUERY_KEY);

      queryClient.setQueryData<Todo[]>(TODO_QUERY_KEY, (old = []) => {
        const optimisticTodo: Todo = {
          id: `temp-${Date.now()}`,
          todo_title: data.todo_title,
          priority: data.priority ?? "MEDIUM",
          progress: data.progress ?? 0,
          userId: "dummy",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return [...old, optimisticTodo];
      });

      return { previousTodos };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(TODO_QUERY_KEY, context.previousTodos);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEY });
    },
  });

  // 更新
  const updateMutation = useApiMutation<
    Todo,
    Error | ApiError,
    UpdateTodoReq,
    { previousTodos: Todo[] | undefined }
  >({
    mutationFn: updateTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<Todo[]>(TODO_QUERY_KEY);

      queryClient.setQueryData<Todo[]>(TODO_QUERY_KEY, (old = []) =>
        old.map((todo) =>
          todo.id === data.id
            ? { ...todo, ...data, updatedAt: new Date() }
            : todo,
        ),
      );

      return { previousTodos };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(TODO_QUERY_KEY, context.previousTodos);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEY });
    },
  });

  // 削除
  const deleteMutation = useApiMutation<
    void,
    Error | ApiError,
    string,
    { previousTodos: Todo[] | undefined }
  >({
    mutationFn: deleteTodoFetch,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<Todo[]>(TODO_QUERY_KEY);
      queryClient.setQueryData<Todo[]>(TODO_QUERY_KEY, (old = []) =>
        old.filter((t) => t.id !== id),
      );
      return { previousTodos };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(TODO_QUERY_KEY, context.previousTodos);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEY });
    },
  });

  return {
    todos: todosQuery.data ?? [],
    createTodo: createMutation.mutateAsync,
    updateTodo: updateMutation.mutateAsync,
    deleteTodo: deleteMutation.mutateAsync,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
