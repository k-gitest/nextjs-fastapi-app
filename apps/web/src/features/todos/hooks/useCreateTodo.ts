"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { Todo, TodoWithImageSummaries } from "../types";
import { createTodoFetch, type CreateTodoReq } from "./todoApi";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";

export const useCreateTodo = () => {
    const queryClient = useQueryClient();

    return useApiMutation<
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
};