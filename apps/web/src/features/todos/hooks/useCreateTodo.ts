"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { Todo } from "../types";
import { createTodoFetch, type CreateTodoReq } from "./todoApi";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";

// 作成直後の一覧反映は楽観的更新ではなくonSettledのinvalidateに委ねる。
// TodoCreateFormContainerとTodoListContainerは兄弟コンポーネントであり、
// filtersはTodoListContainerのlocal stateに閉じているため、作成フォーム側は
// 「現在どのfiltersが表示されているか」を知らない。この制約のためだけに
// filtersの共有範囲を広げず、作成時のみ楽観的更新を行わない設計とする。
export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useApiMutation<Todo, ApiError, CreateTodoReq>({
    mutationFn: createTodoFetch,
    onSettled: () => {
      // TODO_QUERY_KEY(["todos"])は前方一致のため、todoQueryKey(filters)で
      // 生成された全filtersキャッシュ（表示中・非表示中含む）を無効化する。
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEY });
    },
  });
};