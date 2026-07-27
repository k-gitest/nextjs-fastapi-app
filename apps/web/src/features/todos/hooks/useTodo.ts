"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { TodoWithImages } from "../types";
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

  const todosQuery = useSuspenseQuery<TodoWithImages[]>({
    queryKey: TODO_QUERY_KEY,
    queryFn: fetchTodos,
    staleTime: 1000 * 5,
  });

  const createMutation = useApiMutation<
    TodoWithImages,
    ApiError,
    CreateTodoReq,
    { previousTodos: TodoWithImages[] | undefined }
  >({
    mutationFn: createTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImages[]>(TODO_QUERY_KEY);

      queryClient.setQueryData<TodoWithImages[]>(TODO_QUERY_KEY, (old = []) => {
        const optimisticTodo: TodoWithImages = {
          id: `temp-${Date.now()}`,
          todo_title: data.todo_title,
          priority: data.priority ?? "MEDIUM",
          progress: data.progress ?? 0,
          userId: "dummy",
          createdAt: new Date(),
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

  const updateMutation = useApiMutation<
    TodoWithImages,
    ApiError,
    UpdateTodoReq,
    { previousTodos: TodoWithImages[] | undefined }
  >({
    mutationFn: updateTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImages[]>(TODO_QUERY_KEY);

      const { images: _images, ...todoFields } = data;
      queryClient.setQueryData<TodoWithImages[]>(TODO_QUERY_KEY, (old = []) =>
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
    { previousTodos: TodoWithImages[] | undefined }
  >({
    mutationFn: deleteTodoFetch,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImages[]>(TODO_QUERY_KEY);
      queryClient.setQueryData<TodoWithImages[]>(TODO_QUERY_KEY, (old = []) =>
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