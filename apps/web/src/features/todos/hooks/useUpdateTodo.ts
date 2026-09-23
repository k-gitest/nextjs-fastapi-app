"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { Todo, TodoListFilters, TodoWithImageSummaries } from "../types";
import { DEFAULT_TODO_FILTERS } from "../types";
import { updateTodoFetch, type UpdateTodoReq } from "./todoApi";
import { TODO_QUERY_KEY, todoQueryKey } from "@/features/todos/lib/queryKeys";
import { matchesTodoFilters } from "@/features/todos/lib/todoFilters";

// 楽観的更新は「現在表示中のfilters」に対応するキャッシュエントリのみを
// 直接書き換える。他のfiltersのキャッシュ（非表示中）は変更せず、
// onSettledのinvalidateで整合させる（表示されていないキャッシュを
// 無条件で書き換えると、completedOnly/priority条件を満たさない
// Todoが誤って残る/消えるおそれがあるため）。
export const useUpdateTodo = (filters: TodoListFilters = DEFAULT_TODO_FILTERS) => {
    const queryClient = useQueryClient();
    const queryKey = todoQueryKey(filters);

    return useApiMutation<
        Todo,
        ApiError,
        UpdateTodoReq,
        { previousTodos: TodoWithImageSummaries[] | undefined }
    >({
        mutationFn: updateTodoFetch,
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey });
            const previousTodos = queryClient.getQueryData<TodoWithImageSummaries[]>(queryKey);

            const { images: _images, ...todoFields } = data;

            queryClient.setQueryData<TodoWithImageSummaries[]>(queryKey, (old = []) =>
                old.reduce<TodoWithImageSummaries[]>((acc, todo) => {
                    if (todo.id !== data.id) {
                        acc.push(todo);
                        return acc;
                    }

                    const updated = { ...todo, ...todoFields, updatedAt: new Date() };

                    if (matchesTodoFilters(updated, filters)) {
                        acc.push(updated);
                    }
                    return acc;
                }, []),
            );

            return { previousTodos };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(queryKey, context.previousTodos);
            }
        },
        onSettled: () => {
            // TODO_QUERY_KEY(["todos"])は前方一致のため、todoQueryKey(filters)で
            // 生成された全filtersキャッシュ（表示中・非表示中含む）を無効化する。
            queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEY });
        },
    });
};