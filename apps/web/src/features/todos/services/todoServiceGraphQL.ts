/**
 * GraphQL API実装（サービス層）
 *
 * Django版の todo-service-graphql.ts から移植
 *
 * 変更点:
 * - Relay GlobalID（Base64変換）→ 不要（PrismaのIDはcuid文字列）
 * - userEmail → 不要（Auth0で管理）
 * - フック側が受け取る型（Todo）は既存のまま変更なし
 */
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
import {
  GET_TODOS,
  GET_TODO_STATS,
  GET_PROGRESS_STATS,
} from "../graphql/queries";
import { CREATE_TODO, UPDATE_TODO, DELETE_TODO } from "../graphql/mutations";
import type { Todo, CreateTodoInput, UpdateTodoInput } from "../types";

// ===== GraphQL レスポンス型 =====

interface GqlTodo {
  id: string;
  todoTitle: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  progress: number;
  createdAt: string;
  updatedAt: string;
}

interface GetTodosQuery {
  todos: GqlTodo[];
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
  | { __typename: "CreateTodoPayload"; todo: GqlTodo }
  | { __typename: "ValidationError"; message: string; field?: string }
  | { __typename: "InternalError"; message: string };
}

interface UpdateTodoMutation {
  updateTodo:
  | { __typename: "UpdateTodoPayload"; todo: GqlTodo }
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

function gqlTodoToTodo(gql: GqlTodo): Todo {
  return {
    id: gql.id,
    todo_title: gql.todoTitle,
    priority: gql.priority,
    progress: gql.progress,
    userId: "",
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
  };
}

// ===== GraphQL サービス実装 =====

export const todoServiceGraphQL = {
  getTodos: async (): Promise<Todo[]> => {
    const data = await gqlRequest<GetTodosQuery>(GET_TODOS);
    return data.todos.map(gqlTodoToTodo);
  },

  createTodo: async (input: CreateTodoInput): Promise<Todo> => {
    const result = await gqlMutation<CreateTodoMutation, "createTodo">(
      CREATE_TODO,
      {
        input: {
          todoTitle: input.todo_title,
          priority: input.priority ?? "MEDIUM",
          progress: input.progress ?? 0,
        },
      },
      "createTodo"
    );

    if (result.__typename === "CreateTodoPayload") {
      return gqlTodoToTodo(result.todo);
    }

    throw new Error(
      result.__typename === "ValidationError" ? result.message : "作成に失敗しました"
    );
  },

  updateTodo: async (input: UpdateTodoInput): Promise<Todo> => {
    const { id, ...rest } = input;
    const result = await gqlMutation<UpdateTodoMutation, "updateTodo">(
      UPDATE_TODO,
      {
        id,
        input: {
          ...(rest.todo_title && { todoTitle: rest.todo_title }),
          ...(rest.priority && { priority: rest.priority }),
          ...(rest.progress !== undefined && { progress: rest.progress }),
        },
      },
      "updateTodo"
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
      "deleteTodo"
    );

    if (result.__typename !== "DeleteTodoPayload") {
      throw new Error(
        result.__typename === "NotFoundError"
          ? "対象のTodoが見つかりません"
          : "削除に失敗しました"
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