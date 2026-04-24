import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  todoQueryResolvers,
  todoMutationResolvers,
} from "@/graphql/modules/todos/resolvers";
import type { GraphQLContext } from "@/graphql/context";

// todoServiceをモック
vi.mock("@/features/todos/services/todoService", () => ({
  todoService: {
    getTodos: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
    getTodoStats: vi.fn(),
    getProgressStats: vi.fn(),
  },
}));

import { todoService } from "@/features/todos/services/todoService";

const mockUser = {
  id: "clx1234",
  email: "test@example.com",
  name: "テストユーザー",
};

const mockTodo = {
  id: "clxtodo1",
  todo_title: "テストタスク",
  priority: "HIGH" as const,
  progress: 50,
  userId: "clx1234",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const authenticatedContext: GraphQLContext = {
  user: mockUser,
  prisma: {} as never,
  cookieHeader: "session=xxx",
};

const unauthenticatedContext: GraphQLContext = {
  user: null,
  prisma: {} as never,
  cookieHeader: null,
};

describe("todoQueryResolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("todos", () => {
    it("認証済みユーザーのTodo一覧を返す", async () => {
      vi.mocked(todoService.getTodos).mockResolvedValueOnce([mockTodo]);

      const result = await todoQueryResolvers.todos(
        {},
        {},
        authenticatedContext
      );

      expect(todoService.getTodos).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "clxtodo1",
        todoTitle: "テストタスク",
        priority: "HIGH",
        progress: 50,
      });
    });

    it("未認証の場合はGraphQLErrorをthrowする", async () => {
      await expect(
        todoQueryResolvers.todos({}, {}, unauthenticatedContext)
      ).rejects.toThrow();
    });

    it("camelCase変換が正しく行われる", async () => {
      vi.mocked(todoService.getTodos).mockResolvedValueOnce([mockTodo]);

      const result = await todoQueryResolvers.todos(
        {},
        {},
        authenticatedContext
      );

      // todo_title → todoTitle
      expect(result[0]).toHaveProperty("todoTitle");
      expect(result[0]).not.toHaveProperty("todo_title");
      // createdAt は ISO文字列
      expect(typeof result[0].createdAt).toBe("string");
    });
  });

  describe("priorityStats", () => {
    it("優先度別統計を返す", async () => {
      const mockStats = [
        { priority: "HIGH", count: 3 },
        { priority: "MEDIUM", count: 2 },
      ];
      vi.mocked(todoService.getTodoStats).mockResolvedValueOnce(mockStats);

      const result = await todoQueryResolvers.priorityStats(
        {},
        {},
        authenticatedContext
      );

      expect(result).toEqual(mockStats);
    });

    it("未認証の場合はGraphQLErrorをthrowする", async () => {
      await expect(
        todoQueryResolvers.priorityStats({}, {}, unauthenticatedContext)
      ).rejects.toThrow();
    });
  });

  describe("progressStats", () => {
    it("進捗統計を返す", async () => {
      const mockStats = {
        range_0_20: 1,
        range_21_40: 0,
        range_41_60: 2,
        range_61_80: 0,
        range_81_100: 1,
      };
      vi.mocked(todoService.getProgressStats).mockResolvedValueOnce(mockStats);

      const result = await todoQueryResolvers.progressStats(
        {},
        {},
        authenticatedContext
      );

      expect(result).toEqual(mockStats);
    });
  });
});

describe("todoMutationResolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTodo", () => {
    it("Todo作成成功時はCreateTodoPayloadを返す", async () => {
      vi.mocked(todoService.createTodo).mockResolvedValueOnce(mockTodo);

      const result = await todoMutationResolvers.createTodo(
        {},
        {
          input: {
            todoTitle: "テストタスク",
            priority: "HIGH",
            progress: 0,
          },
        },
        authenticatedContext
      );

      expect(result.__typename).toBe("CreateTodoPayload");
      if (result.__typename === "CreateTodoPayload") {
        expect(result.todo.todoTitle).toBe("テストタスク");
      }
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await todoMutationResolvers.createTodo(
        {},
        { input: { todoTitle: "テスト", priority: "MEDIUM", progress: 0 } },
        unauthenticatedContext
      );

      expect(result.__typename).toBe("AuthenticationError");
    });

    it("作成失敗時はInternalErrorを返す", async () => {
      vi.mocked(todoService.createTodo).mockRejectedValueOnce(
        new Error("DB error")
      );

      const result = await todoMutationResolvers.createTodo(
        {},
        { input: { todoTitle: "テスト", priority: "MEDIUM", progress: 0 } },
        authenticatedContext
      );

      expect(result.__typename).toBe("InternalError");
    });
  });

  describe("updateTodo", () => {
    it("Todo更新成功時はUpdateTodoPayloadを返す", async () => {
      const updatedTodo = { ...mockTodo, todo_title: "更新済み" };
      vi.mocked(todoService.updateTodo).mockResolvedValueOnce(updatedTodo);

      const result = await todoMutationResolvers.updateTodo(
        {},
        { id: "clxtodo1", input: { todoTitle: "更新済み" } },
        authenticatedContext
      );

      expect(result.__typename).toBe("UpdateTodoPayload");
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await todoMutationResolvers.updateTodo(
        {},
        { id: "clxtodo1", input: { todoTitle: "更新" } },
        unauthenticatedContext
      );

      expect(result.__typename).toBe("AuthenticationError");
    });
  });

  describe("deleteTodo", () => {
    it("Todo削除成功時はDeleteTodoPayloadを返す", async () => {
      vi.mocked(todoService.deleteTodo).mockResolvedValueOnce(undefined);

      const result = await todoMutationResolvers.deleteTodo(
        {},
        { id: "clxtodo1" },
        authenticatedContext
      );

      expect(result.__typename).toBe("DeleteTodoPayload");
      if (result.__typename === "DeleteTodoPayload") {
        expect(result.deletedId).toBe("clxtodo1");
      }
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await todoMutationResolvers.deleteTodo(
        {},
        { id: "clxtodo1" },
        unauthenticatedContext
      );

      expect(result.__typename).toBe("AuthenticationError");
    });

    it("削除失敗時はInternalErrorを返す", async () => {
      vi.mocked(todoService.deleteTodo).mockRejectedValueOnce(
        new Error("DB error")
      );

      const result = await todoMutationResolvers.deleteTodo(
        {},
        { id: "clxtodo1" },
        authenticatedContext
      );

      expect(result.__typename).toBe("InternalError");
    });
  });
});