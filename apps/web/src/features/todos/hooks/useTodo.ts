"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { TodoWithImages, CreateTodoInput } from "../types";
import { Priority } from "@repo/db";
import { ApiError } from "@/errors/api-error";
import type { ImageInput } from "@/features/images/schemas";

export const TODO_QUERY_KEY = ["todos"] as const;

// フロントからは userId を送らない（Route Handler側で付与する）ため Omit する
// image は Prisma の CreateTodoInput には存在しないため、別フィールドとして追加する
type CreateTodoReq = Omit<CreateTodoInput, "userId"> & { image?: ImageInput };

type UpdateTodoReq = {
  id: string;
  todo_title?: string;
  priority?: Priority;
  progress?: number;
  image?: ImageInput;
};

// Route Handler経由のfetch関数
const fetchTodos = (): Promise<TodoWithImages[]> =>
  fetch("/api/todos").then((res) => {
    if (!res.ok) throw new Error("Failed to fetch todos");
    return res.json();
  });

const createTodoFetch = (data: CreateTodoReq): Promise<TodoWithImages> =>
  fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => {
    if (!res.ok) throw new Error("Failed to create todo");
    return res.json();
  });

const updateTodoFetch = ({ id, ...data }: UpdateTodoReq): Promise<TodoWithImages> =>
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
  const todosQuery = useSuspenseQuery<TodoWithImages[]>({
    queryKey: TODO_QUERY_KEY,
    queryFn: fetchTodos,
    staleTime: 1000 * 5,
  });

  // 作成
  const createMutation = useApiMutation<
    TodoWithImages,
    Error | ApiError,
    CreateTodoReq,
    { previousTodos: TodoWithImages[] | undefined }
  >({
    mutationFn: createTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImages[]>(TODO_QUERY_KEY);

      queryClient.setQueryData<TodoWithImages[]>(TODO_QUERY_KEY, (old = []) => {
        // 楽観的更新では画像はまだ実体（B2上のオブジェクト）はあるがDBのImageレコードはできていないため、
        // 一覧には空配列として表示し、実データはonSettledの再取得で反映する
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

  // 更新
  const updateMutation = useApiMutation<
    TodoWithImages,
    Error | ApiError,
    UpdateTodoReq,
    { previousTodos: TodoWithImages[] | undefined }
  >({
    mutationFn: updateTodoFetch,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEY });
      const previousTodos = queryClient.getQueryData<TodoWithImages[]>(TODO_QUERY_KEY);

      // 画像の楽観的更新は行わない（差し替え・削除の見た目はonSettledの再取得を待つ）
      // dataのimageフィールドはTodoWithImagesには存在しないため、混ぜずに除外する
      const { image: _image, ...todoFields } = data;
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

  // 削除
  const deleteMutation = useApiMutation<
    void,
    Error | ApiError,
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