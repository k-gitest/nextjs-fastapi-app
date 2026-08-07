/**
 * GraphQL API実装（サービス層）
 *
 * services/index.ts のスイッチ層からREST版(todoService.ts)と
 * 透過的に入れ替わるため、公開シグネチャ（引数の型・順序・戻り値の型）は
 * REST版と一致させること。
 *
 * エラー変換について:
 * gqlRequest/gqlMutation は内部でGraphQLエラー・error union結果の両方を
 * ApiError（lib/graphql-client.ts）に正規化してthrowする。そのため、この層に
 * 届いた時点で result.__typename を見て分岐することはできない
 * （エラー系unionが返ってきた時点でgqlMutationが先にthrow済みのため。
 * 以前の実装では result.__typename === "ValidationError" 等の分岐が
 * 実質到達不能なdead codeになっていた）。
 * REST版と同じ例外型（ValidationError/NotFoundError）をRoute Handlerに渡すため、
 * ApiError.status を見て変換し直す（features/albums/services/albumServiceGraphQL.ts
 * と同一パターン）。
 */
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
import { ApiError } from "@/errors/api-error";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";
import {
  GET_TODOS,
  GET_TODO_STATS,
  GET_PROGRESS_STATS,
} from "../graphql/queries";
import { CREATE_TODO, UPDATE_TODO, DELETE_TODO } from "../graphql/mutations";
import type {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  TodoImageSummary,
  TodoWithImageSummaries,
} from "../types";
import type { ImageListInput } from "@/features/images/schemas";

// ===== GraphQL レスポンス型 =====

// getTodos用（images込み）
interface GqlTodoWithImages {
  id: string;
  todoTitle: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  progress: number;
  userId: string;
  images: TodoImageSummary[];
  createdAt: string;
  updatedAt: string;
}

// createTodo/updateTodo用（REST版と同様、mutation結果のimagesは信頼せず
// 空配列固定。直後のinvalidateQueriesで正しい値が反映される設計。
// useTodo.ts の onSettled → invalidateQueries パターンに依拠）
type GqlTodoMutationResult = Omit<GqlTodoWithImages, "images">;

interface GetTodosQuery {
  todos: GqlTodoWithImages[];
}

interface GetTodoStatsQuery {
  priorityStats: Array<{ priority: string; count: number }>;
}

interface GetProgressStatsQuery {
  progressStats: {
    range020: number;
    range2140: number;
    range4160: number;
    range6180: number;
    range81100: number;
  };
}

// gqlMutationがエラーunionを先にthrowするため、成功ペイロード型のみ想定すればよい
interface CreateTodoMutation {
  createTodo: { __typename: "CreateTodoPayload"; todo: GqlTodoMutationResult };
}

interface UpdateTodoMutation {
  updateTodo: { __typename: "UpdateTodoPayload"; todo: GqlTodoMutationResult };
}

interface DeleteTodoMutation {
  deleteTodo: {
    __typename: "DeleteTodoPayload";
    todo: GqlTodoMutationResult;
    deletedId: string;
    message: string;
  };
}

// ===== 型変換 =====

// getTodos用：TodoWithImageSummaries を返す
function gqlTodoToTodoWithImages(gql: GqlTodoWithImages): TodoWithImageSummaries {
  return {
    id: gql.id,
    todo_title: gql.todoTitle,
    priority: gql.priority,
    progress: gql.progress,
    userId: gql.userId,
    images: gql.images,
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
  };
}

// createTodo/updateTodo用：REST版と同じ Todo を返す（imagesフィールドを持たない）
function gqlTodoToTodo(gql: GqlTodoMutationResult): Todo {
  return {
    id: gql.id,
    todo_title: gql.todoTitle,
    priority: gql.priority,
    progress: gql.progress,
    userId: gql.userId,
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
  };
}

// ApiErrorをREST版と同じドメイン例外に変換し直す。
// マッチしないstatus（401/403/500等）はApiErrorのままthrowし、
// Route Handler側のグローバルハンドリングに委ねる。
// Todoドメインは ConflictError を投げるケースがない（P2002制約はAlbumのみ）ため
// ValidationError/NotFoundError の2種のみマッピングする。
function rethrowAsDomainError(e: unknown): never {
  if (e instanceof ApiError) {
    if (e.isNotFoundError) throw new NotFoundError(e.message);
    if (e.isValidationError) throw new ValidationError(e.message);
  }
  throw e;
}

// ===== GraphQL サービス実装 =====

export const todoServiceGraphQL = {
  // userIdはGraphQL側ではcontext.userから解決されるため未使用。
  // REST版(todoService.getTodos(userId))とシグネチャを揃えるために引数として受け取る。
  getTodos: async (_userId: string): Promise<TodoWithImageSummaries[]> => {
    const data = await gqlRequest<GetTodosQuery>(GET_TODOS);
    return data.todos.map(gqlTodoToTodoWithImages);
  },

  createTodo: async (
    input: CreateTodoInput,
    correlationId: string,
    images?: ImageListInput,
  ): Promise<Todo> => {
    try {
      const result = await gqlMutation<CreateTodoMutation, "createTodo">(
        CREATE_TODO,
        {
          input: {
            todoTitle: input.todo_title,
            priority: input.priority ?? "MEDIUM",
            progress: input.progress ?? 0,
            ...(images && { imageIds: images }),
          },
          correlationId,
        },
        "createTodo",
      );
      return gqlTodoToTodo(result.todo);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  // userIdはREST版のシグネチャ互換のために受け取る（GraphQL側は
  // context.userで認証・所有権解決を行うため未使用）。
  updateTodo: async (
    input: UpdateTodoInput,
    _userId: string,
    correlationId: string,
    images?: ImageListInput,
  ): Promise<Todo> => {
    try {
      const { id, ...rest } = input;
      const result = await gqlMutation<UpdateTodoMutation, "updateTodo">(
        UPDATE_TODO,
        {
          id,
          input: {
            ...(rest.todo_title && { todoTitle: rest.todo_title }),
            ...(rest.priority && { priority: rest.priority }),
            ...(rest.progress !== undefined && { progress: rest.progress }),
            ...(images !== undefined && { imageIds: images }),
          },
          correlationId,
        },
        "updateTodo",
      );
      return gqlTodoToTodo(result.todo);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  deleteTodo: async (
    id: string,
    _userId: string,
    correlationId: string,
  ): Promise<Todo> => {
    try {
      const result = await gqlMutation<DeleteTodoMutation, "deleteTodo">(
        DELETE_TODO,
        { id, correlationId },
        "deleteTodo",
      );
      return gqlTodoToTodo(result.todo);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  getTodoStats: async (): Promise<Array<{ priority: string; count: number }>> => {
    const data = await gqlRequest<GetTodoStatsQuery>(GET_TODO_STATS);
    return data.priorityStats;
  },

  getProgressStats: async (): Promise<Array<{ range: string; count: number }>> => {
    const data = await gqlRequest<GetProgressStatsQuery>(GET_PROGRESS_STATS);

    return [
      { range: "0-20%", count: data.progressStats.range020 },
      { range: "21-40%", count: data.progressStats.range2140 },
      { range: "41-60%", count: data.progressStats.range4160 },
      { range: "61-80%", count: data.progressStats.range6180 },
      { range: "81-100%", count: data.progressStats.range81100 },
    ];
  },
};