import { Todo as PrismaTodo, Priority } from "@repo/db";

export type { PrismaTodo };

/**
 * Todo公開DTO（REST API境界での公開契約）。
 *
 * PrismaのTodoモデルをそのまま公開せず、UIが実際に必要とするフィールドのみで
 * 構成する（README.md「公開DTOの設計原則」）。
 *
 * 除外するフィールドと理由:
 * - userId: 所有権情報。Service層内部でのownership checkにのみ必要で、
 *   UIはこの値を必要としない。
 * - createdAt: UIのどこも参照していない（一覧のソートはサーバー側の
 *   orderByで完結している）。
 *
 * 将来的にこれらのフィールドが必要になった場合は、都度この型定義を
 * 明示的に変更すること。
 *
 * このDTOはREST Route Handler境界（todoImageMapper.ts）でのみ適用する。
 * Service層・GraphQL ResolverはPrismaTodo（内部型）を扱う
 * （GraphQL側の公開フィールド整理は別Issueで扱う）。
 */
export interface Todo {
  id: string;
  todo_title: string;
  priority: Priority;
  progress: number;
  updatedAt: Date;
}

/**
 * Todoに紐付いた画像1件分の内部データ（Service層・GraphQL Resolver用）。
 *
 * Prismaの Image 型をそのまま使わず、TodoServiceがTodo画像として返す
 * フィールド（id/originalFileName/mimeType/fileSize）+ TodoImage.order を
 * 明示的に列挙する。storageKey・userId・albumId・createdAt・updatedAt等の
 * Prisma内部表現をこの型に持ち込まない。
 *
 * features/images/types の ImageSummary とは別契約（ImageSummaryは
 * usageCount等、Album/未所属一覧側の公開契約を表す。TodoImageDtoは
 * 「Todoに紐付いた画像＋order」というTodo側の契約であり、意図的に
 * 共通化しない）。
 *
 * todoService.getTodos は Prisma の image オブジェクトを丸ごと
 * スプレッドするのではなく、この4フィールド+orderを明示的に
 * マッピングして返す（Prisma生成型を内部型にも直接持ち込まないための境界）。
 *
 * REST/GraphQL双方がこの形をそのまま利用できるため（既にPrisma非依存・
 * 絞り込み済み）、旧TodoImageSummaryのような別名の軽量型は設けない。
 */
export interface TodoImageDto {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  order: number;
}

// Service層・GraphQL Resolver用の内部型（PrismaTodoベース、絞り込み前）。
export type TodoWithImages = PrismaTodo & { images: TodoImageDto[] };

// フォーム用（ユーザーが入力する値だけを抽出）
export type TodoFormValues = Pick<Todo, "todo_title" | "priority" | "progress">;

/**
 * Todo作成の入力契約（REST/GraphQL共通のServiceインターフェース）。
 *
 * 旧: Prisma.TodoUncheckedCreateInput をそのまま転用していたが、
 * DB書き込みモデルとアプリケーションの入力契約を同一視しない方針に変更した。
 *
 * 役割分担:
 * - CreateTodoInput: Serviceの受け口としてのTypeScript型（このファイル）
 * - todoSchema（schemas/index.ts）: 正規化後のTodo入力に対するバリデーション
 * - PrismaTodo: DBから返る内部モデル
 * - Todo: RESTで公開するDTO
 *
 * priority/progressが任意なのは、Service層でデフォルト補完（?? MEDIUM, ?? 0）
 * した後にtodoSchema（全フィールド必須）で検証する、という現行の正規化フローを
 * 反映したもの。「ドメインZodスキーマを単一の情報源とする」原則は検証ロジックの
 * 重複を避けることが主眼であり、todoSchemaは既にその役割を担っている。
 * CreateTodoInputはZodのinferred型と一致させる必要はない。
 *
 * userIdはCreateAlbumInputと同じパターンで、REST/GraphQL両実装が共有する
 * 入力型にそのまま含める（GraphQL側はcontext.userを使うためuserIdを無視する。
 * Serviceの別引数に分離するのではなく、既存のCreateAlbumInputパターンに揃える）。
 */
export interface CreateTodoInput {
  todo_title: string;
  priority?: Priority;
  progress?: number;
  userId: string;
}

// 更新用：IDは必須、それ以外は任意
export type UpdateTodoInput = {
  id: string;
  todo_title?: string;
  priority?: Priority;
  progress?: number;
};

// NOTE: images（複数添付ファイル）は todoService.createTodo / updateTodo の
// 第4引数として別パラメータで渡す（features/images/schemas の ImageListInput）。
// CreateTodoInput / UpdateTodoInput には含めない。

// REST公開DTO用（images込み）。トップレベルはTodo（公開DTO）、imagesは
// TodoImageDto（既にPrisma非依存・絞り込み済みのため、GraphQL/REST用に
// 別途軽量型を設ける必要がなくなった。旧TodoImageSummaryは廃止）。
export type TodoWithImageSummaries = Todo & { images: TodoImageDto[] };