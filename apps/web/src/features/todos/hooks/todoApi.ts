import { toApiError } from "@/errors/api-error";
import { Priority } from "@repo/db";
import type { TodoWithImageSummaries, Todo, CreateTodoInput } from "../types";
import type { ImageListInput } from "@/features/images/schemas";

// useTodo.tsから移設。Image/Albumと同じAPI層構造（fetch関数の分離 + ApiError統一）に揃える。
//
// Image作成はTodo保存より前にPOST /api/imagesで完了しているため、
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

// GET /api/todos は toTodoWithImageSummaries() 適用後のレスポンス
// （Todo本体 + images: TodoImageDto[]、userId/createdAtなし）を返す。
export const fetchTodos = (): Promise<TodoWithImageSummaries[]> =>
  fetch("/api/todos").then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

// POST /api/todos は toTodoDTO() 適用後のレスポンス（imagesを含まないTodo）を返す。
export const createTodoFetch = (data: CreateTodoReq): Promise<Todo> =>
  fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

// PATCH /api/todos/[id] も同様にtoTodoDTO()適用後のTodoを返す。
export const updateTodoFetch = ({ id, ...data }: UpdateTodoReq): Promise<Todo> =>
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