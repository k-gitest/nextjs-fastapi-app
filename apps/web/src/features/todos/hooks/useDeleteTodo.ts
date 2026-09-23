"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { TodoListFilters, TodoWithImageSummaries } from "../types";
import { DEFAULT_TODO_FILTERS } from "../types";
import { deleteTodoFetch } from "./todoApi";
import { TODO_QUERY_KEY, todoQueryKey } from "@/features/todos/lib/queryKeys";

// 削除は判定を要さず、表示中キャッシュから対象IDを無条件で除去する
// （どのfilters条件下でも削除された事実は変わらないため）。
export const useDeleteTodo = (filters: TodoListFilters = DEFAULT_TODO_FILTERS) => {
    const queryClient = useQueryClient();
    const queryKey = todoQueryKey(filters);

    return useApiMutation<
        void,
        ApiError,
        string,
        { previousTodos: TodoWithImageSummaries[] | undefined }
    >({
        mutationFn: deleteTodoFetch,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey });
            const previousTodos = queryClient.getQueryData<TodoWithImageSummaries[]>(queryKey);
            queryClient.setQueryData<TodoWithImageSummaries[]>(queryKey, (old = []) =>
                old.filter((t) => t.id !== id),
            );
            return { previousTodos };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(queryKey, context.previousTodos);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEY });
        },
    });
};