import { Prisma, Todo as PrismaTodo, Priority } from "@prisma/client";

// 基本のTodo型
export type Todo = PrismaTodo;

// フォーム用（ユーザーが入力する値だけを抽出）
export type TodoFormValues = Pick<Todo, "todo_title" | "priority" | "progress">;

// 作成用：Prismaの「作成用オブジェクト型」から必要なものだけ選ぶ
// これにより、Prismaが期待する型と完全に一致します
export type CreateTodoInput = Prisma.TodoUncheckedCreateInput;

// 更新用：IDは必須、それ以外は任意
// 問題: Prisma.TodoUncheckedUpdateInput の各フィールドは
// string | StringFieldUpdateOperationsInput | undefined のような
// Prisma内部型になるため、フロントで使いにくい
/*
export type UpdateTodoInput = Prisma.TodoUncheckedUpdateInput & {
  id: string; // where 句に使うため ID は必須にする
};
*/
export type UpdateTodoInput = {
  id: string;
  todo_title?: string;
  priority?: Priority;
  progress?: number;
};

/*
export interface Todo {
  id: string;
  todo_title: string;
  priority: Priority;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}
*/

// フォームの送信値（userId不要・idなし）
/*
export interface TodoFormValues {
  todo_title: string;
  priority: Priority;
  progress: number;
}
*/