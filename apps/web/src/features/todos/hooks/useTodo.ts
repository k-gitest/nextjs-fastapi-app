"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { Todo, TodoWithImageSummaries } from "../types";
import { ApiError } from "@/errors/api-error";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";
import {
  fetchTodos,
  createTodoFetch,
  updateTodoFetch,
  deleteTodoFetch,
  type CreateTodoReq,
  type UpdateTodoReq,
} from "./todoApi";

export const useTodo = () => {
  const queryClient = useQueryClient();

  // GET /api/todos の実レスポンス（toTodoWithImageSummaries適用後）に合わせる。
  const todosQuery = useSuspenseQuery<TodoWithImageSummaries[]>({
    queryKey: TODO_QUERY_KEY,
    queryFn: fetchTodos,
    staleTime: 1000 * 5,
  });

  // POST /api/todos の実レスポンス（toTodoDTO適用後）に合わせ、TDataをTodoにする。
  // キャッシュ自体はTodoWithImageSummaries[]のため、contextの型もそれに揃える。
  const createMutation = useApiMutation<
    Todo,
    ApiError,
    CreateTodoReq,
    { previousTodos: TodoWithImageSummaries[] | undefined }
  >({
    mutationFn: createTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImageSummaries[]>(TODO_QUERY_KEY);

      queryClient.setQueryData<TodoWithImageSummaries[]>(TODO_QUERY_KEY, (old = []) => {
        // TodoWithImageSummariesはuserId/createdAtを持たないため、
        // 型合わせのためだけのダミー値（旧: userId: "dummy"）はもう不要。
        const optimisticTodo: TodoWithImageSummaries = {
          id: `temp-${Date.now()}`,
          todo_title: data.todo_title,
          priority: data.priority ?? "MEDIUM",
          progress: data.progress ?? 0,
          updatedAt: new Date(),
          images: [],
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

  // PATCH /api/todos/[id] の実レスポンス（toTodoDTO適用後）に合わせ、TDataをTodoにする。
  const updateMutation = useApiMutation<
    Todo,
    ApiError,
    UpdateTodoReq,
    { previousTodos: TodoWithImageSummaries[] | undefined }
  >({
    mutationFn: updateTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImageSummaries[]>(TODO_QUERY_KEY);

      const { images: _images, ...todoFields } = data;
      queryClient.setQueryData<TodoWithImageSummaries[]>(TODO_QUERY_KEY, (old = []) =>
        old.map((todo) =>
          todo.id === data.id
            ? { ...todo, ...todoFields, updatedAt: new Date() }
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

  const deleteMutation = useApiMutation<
    void,
    ApiError,
    string,
    { previousTodos: TodoWithImageSummaries[] | undefined }
  >({
    mutationFn: deleteTodoFetch,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImageSummaries[]>(TODO_QUERY_KEY);
      queryClient.setQueryData<TodoWithImageSummaries[]>(TODO_QUERY_KEY, (old = []) =>
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