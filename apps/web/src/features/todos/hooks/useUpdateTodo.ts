"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { Todo, TodoWithImageSummaries } from "../types";
import { updateTodoFetch, type UpdateTodoReq } from "./todoApi";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";

export const useUpdateTodo = () => {
    const queryClient = useQueryClient();

    return useApiMutation<
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
};