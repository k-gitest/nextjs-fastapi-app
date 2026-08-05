import type {
  Todo,
  TodoImageDto,
  TodoImageSummary,
  TodoWithImageSummaries,
} from "../types";

// REST/GraphQLどちらの実装がtodoService.getTodosの背後にあっても
// 安全に変換できるよう、TodoImageDto全体ではなく、Summary化に必要な
// 5フィールドのみを要求する型を受け取る。
type ImageSourceForSummary = Pick<
  TodoImageDto,
  "id" | "originalFileName" | "mimeType" | "fileSize" | "order"
>;

// storageKey・albumId・userId・createdAt・updatedAtはクライアントに
// 公開しない（storageKey漏洩対策）。
//
// GraphQL resolvers.ts の toGraphQLTodo() にも同種の変換ロジックが存在するが、
// snake_case→camelCase変換・Union型対応まで含む別レイヤーの処理のため、
// 意図的に共通化せず独立させている。
export function toTodoImageSummary(img: ImageSourceForSummary): TodoImageSummary {
  return {
    id: img.id,
    originalFileName: img.originalFileName,
    mimeType: img.mimeType,
    fileSize: img.fileSize,
    order: img.order,
  };
}

// Todo本体のフィールド + images（絞り込み前）という入力型を明示する。
// TodoWithImages（images: TodoImageDto[]）も TodoWithImageSummaries
// （images: TodoImageSummary[]）も、どちらもこの入力型を構造的に満たす
// （TodoImageDto・TodoImageSummaryは共にImageSourceForSummaryの必須フィールドを持つ）。
// 分割代入でimagesを切り離すことで、restは常にTodo型と一致し、
// キャスト無しで戻り値の型を組み立てられる。
type TodoWithImageSource = Todo & { images: ImageSourceForSummary[] };

export function toTodoWithImageSummaries(
  todo: TodoWithImageSource,
): TodoWithImageSummaries {
  const { images, ...rest } = todo;
  return {
    ...rest,
    images: images.map(toTodoImageSummary),
  };
}