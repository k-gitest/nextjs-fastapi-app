/**
 * GraphQL API実装（サービス層）
 *
 * services/index.ts のスイッチ層からREST版(todoService.ts)と
 * 透過的に入れ替わるため、公開シグネチャ（引数の型・順序・戻り値の型）は
 * REST版と一致させること。
 */
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
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

interface CreateTodoMutation {
  createTodo:
    | { __typename: "CreateTodoPayload"; todo: GqlTodoMutationResult }
    | { __typename: "ValidationError"; message: string; field?: string }
    | { __typename: "InternalError"; message: string };
}

interface UpdateTodoMutation {
  updateTodo:
    | { __typename: "UpdateTodoPayload"; todo: GqlTodoMutationResult }
    | { __typename: "ValidationError"; message: string; field?: string }
    | { __typename: "NotFoundError"; message: string }
    | { __typename: "InternalError"; message: string };
}

interface DeleteTodoMutation {
  deleteTodo:
    | { __typename: "DeleteTodoPayload"; deletedId: string; message: string }
    | { __typename: "NotFoundError"; message: string }
    | { __typename: "InternalError"; message: string };
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

    if (result.__typename === "CreateTodoPayload") {
      return gqlTodoToTodo(result.todo);
    }

    throw new Error(
      result.__typename === "ValidationError" ? result.message : "作成に失敗しました",
    );
  },

  // userIdはREST版のシグネチャ互換のために受け取る（GraphQL側は
  // context.userで認証・所有権解決を行うため未使用）。
  updateTodo: async (
    input: UpdateTodoInput,
    _userId: string,
    correlationId: string,
    images?: ImageListInput,
  ): Promise<Todo> => {
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

    if (result.__typename === "UpdateTodoPayload") {
      return gqlTodoToTodo(result.todo);
    }

    throw new Error("更新に失敗しました");
  },

  deleteTodo: async (id: string): Promise<void> => {
    const result = await gqlMutation<DeleteTodoMutation, "deleteTodo">(
      DELETE_TODO,
      { id },
      "deleteTodo",
    );

    if (result.__typename !== "DeleteTodoPayload") {
      throw new Error(
        result.__typename === "NotFoundError"
          ? "対象のTodoが見つかりません"
          : "削除に失敗しました",
      );
    }
  },

  getTodoStats: async (): Promise<Array<{ priority: string; count: number }>> => {
    const data = await gqlRequest<GetTodoStatsQuery>(GET_TODO_STATS);
    return data.priorityStats;
  },

  getProgressStats: async (): Promise<Record<string, number>> => {
    const data = await gqlRequest<GetProgressStatsQuery>(GET_PROGRESS_STATS);
    return {
      range_0_20: data.progressStats.range020,
      range_21_40: data.progressStats.range2140,
      range_41_60: data.progressStats.range4160,
      range_61_80: data.progressStats.range6180,
      range_81_100: data.progressStats.range81100,
    };
  },
};