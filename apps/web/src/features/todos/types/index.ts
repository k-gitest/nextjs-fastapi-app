import { Prisma, Todo as PrismaTodo, Priority } from "@repo/db";

// 基本のTodo型
export type Todo = PrismaTodo;

// getTodos() が images を include するようになったため、一覧表示・詳細表示にはこちらを使う
// Prisma.TodoGetPayload を使うことで、実際のincludeクエリと型が完全に一致し、
// スキーマ変更時にも自動で追従する。
// include形状はtodoService.getTodosの実クエリ（images: { orderBy: { order: "asc" } }）と
// 一致させること。ずれても型エラーにはならないが、コメントの設計意図（自動追従）が崩れる。
export type TodoWithImages = Prisma.TodoGetPayload<{
  include: { images: { orderBy: { order: "asc" } } };
}>;

// フォーム用（ユーザーが入力する値だけを抽出）
export type TodoFormValues = Pick<Todo, "todo_title" | "priority" | "progress">;

// 作成用：Prismaの「作成用オブジェクト型」から必要なものだけ選ぶ
// これにより、Prismaが期待する型と完全に一致します
export type CreateTodoInput = Prisma.TodoUncheckedCreateInput;

// 更新用：IDは必須、それ以外は任意
// 問題: Prisma.TodoUncheckedUpdateInput の各フィールドは
// string | StringFieldUpdateOperationsInput | undefined のような
// Prisma内部型になるため、フロントで使いにくい

export type UpdateTodoInput = {
  id: string;
  todo_title?: string;
  priority?: Priority;
  progress?: number;
};

// NOTE: images（複数添付ファイル）は todoService.createTodo / updateTodo の
// 第4引数として別パラメータで渡す（features/images/schemas の CreateImageListInput / ImageListInput）。
// CreateTodoInput / UpdateTodoInput には含めない
// （Prismaのcreate/update dataにそのまま渡しているため、
//  Todoテーブルに存在しないフィールドを混ぜると型エラーになる）。