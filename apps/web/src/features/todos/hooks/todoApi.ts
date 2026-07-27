import { toApiError } from "@/errors/api-error";
import { Priority } from "@repo/db";
import type { TodoWithImages, CreateTodoInput } from "../types";
import type { ImageListInput } from "@/features/images/schemas";

// useTodo.tsから移設。Image/Albumと同じAPI層構造（fetch関数の分離 + ApiError統一）に揃える。
//
// PR3以降、Image作成はTodo保存より前にPOST /api/imagesで完了しているため、
// 作成時（POST）も更新時（PATCH）も同じImageListInput（imageIdの配列）を使う。
type CreateTodoReq = Omit<CreateTodoInput, "userId"> & {
  images?: ImageListInput;
};

type UpdateTodoReq = {
  id: string;
  todo_title?: string;
  priority?: Priority;
  progress?: number;
  images?: ImageListInput;
};

export const fetchTodos = (): Promise<TodoWithImages[]> =>
  fetch("/api/todos").then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const createTodoFetch = (data: CreateTodoReq): Promise<TodoWithImages> =>
  fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const updateTodoFetch = ({ id, ...data }: UpdateTodoReq): Promise<TodoWithImages> =>
  fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const deleteTodoFetch = (id: string): Promise<void> =>
  fetch(`/api/todos/${id}`, { method: "DELETE" }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
  });

export type { CreateTodoReq, UpdateTodoReq };