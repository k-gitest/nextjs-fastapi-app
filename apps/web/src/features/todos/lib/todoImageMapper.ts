import type {
  PrismaTodo,
  Todo,
  TodoImageDto,
  TodoWithImages,
  TodoWithImageSummaries,
} from "../types";

// storageKey・albumId・userId・createdAt・updatedAtはクライアントに
// 公開しない（storageKey漏洩対策）。
//
// GraphQL resolvers.ts の toGraphQLTodo() にも同種の変換ロジックが存在するが、
// snake_case→camelCase変換・Union型対応まで含む別レイヤーの処理のため、
// 意図的に共通化せず独立させている。
//
// NOTE: TodoImageDto自体が既にPrisma非依存・絞り込み済みの明示的interfaceで
// あるため、入出力ともにTodoImageDtoをそのまま使う。旧実装ではここに
// ImageSourceForSummary（Pick型）とTodoImageSummary（戻り値型）という
// 2つの別名が存在したが、いずれもTodoImageDtoと同一形状だったため廃止した。
// 関数名は変換の役割を表すものとして維持し、改名はしていない。
export function toTodoImageSummary(img: TodoImageDto): TodoImageDto {
  return {
    id: img.id,
    originalFileName: img.originalFileName,
    mimeType: img.mimeType,
    fileSize: img.fileSize,
    order: img.order,
  };
}

/**
 * トップレベルのTodo本体（userId・createdAtを含む）+ imagesを、
 * 公開DTO（TodoWithImageSummaries）へ変換する。
 *
 * 入力型は既存の TodoWithImages（Service層の戻り値型そのもの）をそのまま
 * 使う。ここでも同一形状の型別名を新設しない。
 *
 * 旧実装はimagesのみを絞り込み、トップレベル（userId等）は素通ししていたが、
 * これは実際のRESTレスポンスにuserIdが含まれ続けるという既存の実害だった。
 * トップレベルも明示的フィールド列挙で絞り込む
 * ことで、公開DTOの定義と実レスポンスを一致させる。
 */
export function toTodoWithImageSummaries(
  todo: TodoWithImages,
): TodoWithImageSummaries {
  return {
    id: todo.id,
    todo_title: todo.todo_title,
    priority: todo.priority,
    progress: todo.progress,
    updatedAt: todo.updatedAt,
    images: todo.images.map(toTodoImageSummary),
  };
}

/**
 * createTodo/updateTodoの戻り値（PrismaTodo、images無し）を
 * Todo（REST公開DTO）へ変換する。
 * deleteTodoはRoute Handlerが204・no-bodyで返すためmapper適用対象外。
 */
export function toTodoDTO(todo: PrismaTodo): Todo {
  return {
    id: todo.id,
    todo_title: todo.todo_title,
    priority: todo.priority,
    progress: todo.progress,
    updatedAt: todo.updatedAt,
  };
}