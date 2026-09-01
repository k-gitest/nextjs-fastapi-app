import type { Todo, TodoImageDto, TodoWithImageSummaries } from "../types";

/**
 * storageKey・albumId・userId・createdAt・updatedAtはクライアントに
 * 公開しない（storageKey漏洩対策）。
 * 
 * GraphQL resolvers.ts の toGraphQLTodo() にも同種の変換ロジックが存在するが、
 * snake_case→camelCase変換・Union型対応まで含む別レイヤーの処理のため、
 * 意図的に共通化せず独立させている。
 * 
 * NOTE: TodoImageDto自体が既にPrisma非依存・絞り込み済みの明示的interfaceで
 * あるため、入出力ともにTodoImageDtoをそのまま使う。旧実装ではここに
 * ImageSourceForSummary（Pick型）とTodoImageSummary（戻り値型）という
 * 2つの別名が存在したが、いずれもTodoImageDtoと同一形状だったため廃止した。
 * 関数名は変換の役割を表すものとして維持し、改名はしていない。
 */
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
 * TodoWithImageSummaries（Service契約）からREST公開DTOへの変換。
 *
 * Service契約とREST公開DTOが同じ最小契約であるため、
 * 現時点ではフィールド削除は発生しない。
 * Route Handler境界で公開フィールドを明示的に列挙することで、
 * Service契約が将来広がった場合にも不要なフィールドが
 * REST APIへ流出しないようにする。
 */
export function toTodoWithImageSummaries(
  todo: TodoWithImageSummaries,
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
 * createTodo/updateTodoの戻り値（Todo、images無し）を
 * Todo（REST公開DTO）へ変換する。
 *
 * Service契約とREST公開DTOが同じ最小契約であっても、
 * Route Handler境界で公開フィールドを明示的に列挙するため、
 * mapperとして維持する。
 */
export function toTodoDTO(todo: Todo): Todo {
  return {
    id: todo.id,
    todo_title: todo.todo_title,
    priority: todo.priority,
    progress: todo.progress,
    updatedAt: todo.updatedAt,
  };
}