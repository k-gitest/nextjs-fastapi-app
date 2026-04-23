/**
 * Todo GraphQL リゾルバー（サーバー側）
 *
 * 責務:
 * - 認証チェック
 * - 引数を受け取り既存todoServiceを呼ぶ
 * - GraphQL型への変換
 *
 * ビジネスロジックは features/todos/services/todoService.ts に委譲
 */
import type { GraphQLContext } from "../../context";
import { todoService } from "@/features/todos/services/todoService";

// ===== 型変換ヘルパー =====

function toGraphQLTodo(todo: {
  id: string;
  todo_title: string;
  priority: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: todo.id,
    todoTitle: todo.todo_title,
    priority: todo.priority,
    progress: todo.progress,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  };
}

function requireAuth(context: GraphQLContext) {
  if (!context.user) {
    return {
      __typename: "AuthenticationError" as const,
      category: "AUTHENTICATION",
      message: "認証が必要です",
      code: "authentication_error",
    };
  }
  return null;
}

// ===== Query リゾルバー =====

export const todoQueryResolvers = {
  todos: async (_: unknown, __: unknown, context: GraphQLContext) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    const todos = await todoService.getTodos(context.user!.id);
    return todos.map(toGraphQLTodo);
  },

  priorityStats: async (_: unknown, __: unknown, context: GraphQLContext) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    return await todoService.getTodoStats(context.user!.id);
  },

  progressStats: async (_: unknown, __: unknown, context: GraphQLContext) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    return await todoService.getProgressStats(context.user!.id);
  },

  searchTodos: async (
    _: unknown,
    { input }: { input: { query: string; topK?: number; minScore?: number } },
    context: GraphQLContext
  ) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    const res = await fetch(
      `/api/todos/search?q=${encodeURIComponent(input.query)}&top_k=${input.topK ?? 5}&min_score=${input.minScore ?? 0.5}`,
      { headers: { cookie: context.cookieHeader ?? "" } }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: {
      id: string;
      title: string;
      priority: string;
      progress: number;
      score: number;
    }) => ({
      id: r.id,
      todoTitle: r.title,
      priority: r.priority,
      progress: r.progress,
      score: r.score,
    }));
  },
};

// ===== Mutation リゾルバー =====

export const todoMutationResolvers = {
  createTodo: async (
    _: unknown,
    { input }: { input: { todoTitle: string; priority: string; progress: number } },
    context: GraphQLContext
  ) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    try {
      const todo = await todoService.createTodo({
        todo_title: input.todoTitle,
        priority: input.priority as "HIGH" | "MEDIUM" | "LOW",
        progress: input.progress ?? 0,
        userId: context.user!.id,
      });

      return {
        __typename: "CreateTodoPayload" as const,
        todo: toGraphQLTodo(todo),
      };
    } catch (e) {
      return {
        __typename: "InternalError" as const,
        category: "INTERNAL",
        message: "Todo作成に失敗しました",
        code: "internal_error",
      };
    }
  },

  updateTodo: async (
    _: unknown,
    {
      id,
      input,
    }: {
      id: string;
      input: { todoTitle?: string; priority?: string; progress?: number };
    },
    context: GraphQLContext
  ) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    try {
      const todo = await todoService.updateTodo({
        id,
        ...(input.todoTitle && { todo_title: input.todoTitle }),
        ...(input.priority && { priority: input.priority as "HIGH" | "MEDIUM" | "LOW" }),
        ...(input.progress !== undefined && { progress: input.progress }),
      });

      return {
        __typename: "UpdateTodoPayload" as const,
        todo: toGraphQLTodo(todo),
      };
    } catch (e) {
      return {
        __typename: "InternalError" as const,
        category: "INTERNAL",
        message: "Todo更新に失敗しました",
        code: "internal_error",
      };
    }
  },

  deleteTodo: async (
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    try {
      await todoService.deleteTodo(id);
      return {
        __typename: "DeleteTodoPayload" as const,
        deletedId: id,
        message: "Todoを削除しました",
      };
    } catch (e) {
      return {
        __typename: "InternalError" as const,
        category: "INTERNAL",
        message: "Todo削除に失敗しました",
        code: "internal_error",
      };
    }
  },
};