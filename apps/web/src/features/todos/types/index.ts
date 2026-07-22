import { Prisma, Todo as PrismaTodo, Priority, Image } from "@repo/db";

// 基本のTodo型
export type Todo = PrismaTodo;

// todoService.getTodos が返すDTO形。
// Prismaの Image 型（Phase3-3でtodoId/orderを削除済み）に対し、
// TodoImage.order を "order" として合成した形を返しているため、
// Image型そのものではなく Image & { order: number } とする。
export type TodoImageDto = Image & { order: number };

export type TodoWithImages = Todo & { images: TodoImageDto[] };

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
// 第4引数として別パラメータで渡す（features/images/schemas の ImageListInput）。
// PR3以降、Image作成はPOST /api/imagesでTodo保存より前に完了しているため、
// createTodo/updateTodo両方とも同じImageListInput（imageIdの配列）を受け取る
// （旧: 作成時のみkind:"new"を強制するCreateImageListInputという別型があったが、
//  existing/newの区別自体がAPI境界から消えたため統一した）。
// CreateTodoInput / UpdateTodoInput には含めない
// （Prismaのcreate/update dataにそのまま渡しているため、
//  Todoテーブルに存在しないフィールドを混ぜると型エラーになる）。