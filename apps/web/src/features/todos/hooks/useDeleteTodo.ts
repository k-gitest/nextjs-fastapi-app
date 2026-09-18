"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { TodoWithImageSummaries } from "../types";
import { deleteTodoFetch } from "./todoApi";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";

export const useDeleteTodo = () => {
    const queryClient = useQueryClient();

    return useApiMutation<
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
};