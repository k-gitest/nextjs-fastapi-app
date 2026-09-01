import { describe, it, expect, vi, beforeEach } from "vitest";
import { todoServiceGraphQL } from "@/features/todos/services/todoServiceGraphQL";
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
import { ApiError } from "@/errors/api-error";
import { ValidationError } from "@/errors/validation-error";
import { NotFoundError } from "@/errors/not-found-error";

vi.mock("@/lib/graphql-client", () => ({
  gqlRequest: vi.fn(),
  gqlMutation: vi.fn(),
}));

// gqlMutation は複数の異なる戻り値型を持つオーバーロードのため
// vi.mocked だと never 型になる。ReturnType<typeof vi.fn> でキャストして回避する
const mockedGqlMutation = gqlMutation as ReturnType<typeof vi.fn>;
const mockedGqlRequest = gqlRequest as ReturnType<typeof vi.fn>;

describe("todoServiceGraphQL", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");

  const baseGqlTodo = {
    id: "clx1234",
    todoTitle: "テストタスク",
    priority: "HIGH" as const,
    progress: 50,
    updatedAt: now.toISOString(),
  };

  const expectedTodo = {
    id: "clx1234",
    todo_title: "テストタスク",
    priority: "HIGH",
    progress: 50,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== getTodos =====

  describe("getTodos", () => {
    it("GqlTodo の camelCase フィールドが Todo の snake_case に変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({ todos: [baseGqlTodo] });

      const result = await todoServiceGraphQL.getTodos("user1");

      expect(result).toEqual([expectedTodo]);
    });

    it("updatedAt が Date オブジェクトに変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({ todos: [baseGqlTodo] });

      const result = await todoServiceGraphQL.getTodos("user1");

      expect(result[0].updatedAt).toBeInstanceOf(Date);
    });

    it("空配列が返ってきた場合、空配列をそのまま返すこと", async () => {
      mockedGqlRequest.mockResolvedValue({ todos: [] });

      const result = await todoServiceGraphQL.getTodos("user1");

      expect(result).toEqual([]);
    });
  });

  // ===== createTodo =====

  describe("createTodo", () => {
    // userId は CreateTodoInput の必須フィールド
    const input = {
      todo_title: "新しいタスク",
      priority: "MEDIUM" as const,
      progress: 0,
      userId: "user1",
    };

    it("CreateTodoPayload が返った場合、変換済みの Todo を返すこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "CreateTodoPayload",
        todo: { ...baseGqlTodo, todoTitle: "新しいタスク", priority: "MEDIUM", progress: 0 },
      });

      const result = await todoServiceGraphQL.createTodo(input, "test-correlation-id");

      expect(result.todo_title).toBe("新しいタスク");
      expect(result.priority).toBe("MEDIUM");
    });

    it("priority が未指定の場合、MEDIUM としてミューテーションに渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "CreateTodoPayload",
        todo: baseGqlTodo,
      });

      await todoServiceGraphQL.createTodo({ todo_title: "タスク", userId: "user1" }, "test-correlation-id");

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({ priority: "MEDIUM" }),
        }),
        "createTodo"
      );
    });

    it("progress が未指定の場合、0 としてミューテーションに渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "CreateTodoPayload",
        todo: baseGqlTodo,
      });

      await todoServiceGraphQL.createTodo({ todo_title: "タスク", userId: "user1" }, "test-correlation-id");

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({ progress: 0 }),
        }),
        "createTodo"
      );
    });

    it("ValidationError が返った場合、ValidationErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(400, "タイトルは必須です"));

      await expect(
        todoServiceGraphQL.createTodo(input, "test-correlation-id"),
      ).rejects.toThrow(ValidationError);
      await expect(
        todoServiceGraphQL.createTodo(input, "test-correlation-id"),
      ).rejects.toThrow("タイトルは必須です");
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(500, "Internal server error"));

      await expect(
        todoServiceGraphQL.createTodo(input, "test-correlation-id"),
      ).rejects.toThrow(ApiError);
      await expect(
        todoServiceGraphQL.createTodo(input, "test-correlation-id"),
      ).rejects.toThrow("Internal server error");
    });
  });

  // ===== updateTodo =====

  describe("updateTodo", () => {
    it("UpdateTodoPayload が返った場合、変換済みの Todo を返すこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateTodoPayload",
        todo: { ...baseGqlTodo, todoTitle: "更新済み", progress: 100 },
      });

      const result = await todoServiceGraphQL.updateTodo(
        {
          id: "clx1234",
          todo_title: "更新済み",
          progress: 100,
        },
        "user1",
        "test-correlation-id",
      );

      expect(result.todo_title).toBe("更新済み");
      expect(result.progress).toBe(100);
    });

    it("id はミューテーションの input に含まれず、トップレベルの引数として渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateTodoPayload",
        todo: baseGqlTodo,
      });

      await todoServiceGraphQL.updateTodo(
        { id: "clx1234", todo_title: "更新済み" },
        "user1",
        "test-correlation-id",
      );

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: "clx1234",
          input: expect.not.objectContaining({ id: expect.anything() }),
        }),
        "updateTodo"
      );
    });

    it("undefined なフィールドはミューテーションの input に含まれないこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateTodoPayload",
        todo: baseGqlTodo,
      });

      await todoServiceGraphQL.updateTodo(
        { id: "clx1234", progress: 80 },
        "user1",
        "test-correlation-id",
      );

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: { progress: 80 },
        }),
        "updateTodo"
      );
    });

    it("NotFoundError が返った場合、NotFoundErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(404, "not found"));

      await expect(
        todoServiceGraphQL.updateTodo(
          { id: "clx9999", todo_title: "更新" },
          "user1",
          "test-correlation-id",
        ),
      ).rejects.toThrow(NotFoundError);
      await expect(
        todoServiceGraphQL.updateTodo(
          { id: "clx9999", todo_title: "更新" },
          "user1",
          "test-correlation-id",
        ),
      ).rejects.toThrow("not found");
    });
  });

  // ===== deleteTodo =====

  describe("deleteTodo", () => {
    it("DeleteTodoPayload が返った場合、変換済みの Todo を返すこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "DeleteTodoPayload",
        todo: baseGqlTodo,
        deletedId: "clx1234",
        message: "削除しました",
      });

      const result = await todoServiceGraphQL.deleteTodo("clx1234", "user1", "test-correlation-id");

      expect(result).toEqual(expectedTodo);
    });

    it("NotFoundError が返った場合、NotFoundErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(404, "対象のTodoが見つかりません"));

      await expect(
        todoServiceGraphQL.deleteTodo("clx9999", "user1", "test-correlation-id"),
      ).rejects.toThrow(NotFoundError);
      await expect(
        todoServiceGraphQL.deleteTodo("clx9999", "user1", "test-correlation-id"),
      ).rejects.toThrow("対象のTodoが見つかりません");
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(500, "server error"));

      await expect(
        todoServiceGraphQL.deleteTodo("clx1234", "user1", "test-correlation-id"),
      ).rejects.toThrow(ApiError);
      await expect(
        todoServiceGraphQL.deleteTodo("clx1234", "user1", "test-correlation-id"),
      ).rejects.toThrow("server error");
    });
  });

  // ===== getTodoStats =====

  describe("getTodoStats", () => {
    it("priorityStats をそのまま返すこと", async () => {
      const mockStats = [
        { priority: "HIGH", count: 3 },
        { priority: "MEDIUM", count: 2 },
        { priority: "LOW", count: 1 },
      ];
      mockedGqlRequest.mockResolvedValue({ priorityStats: mockStats });

      const result = await todoServiceGraphQL.getTodoStats();

      expect(result).toEqual(mockStats);
    });
  });

  // ===== getProgressStats =====

  describe("getProgressStats", () => {
    it("GraphQLのオブジェクト形式（range020等）がRESTと同じ配列形式に変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({
        progressStats: {
          range020: 1,
          range2140: 2,
          range4160: 3,
          range6180: 4,
          range81100: 5,
        },
      });

      const result = await todoServiceGraphQL.getProgressStats();

      expect(result).toEqual([
        { range: "0-20%", count: 1 },
        { range: "21-40%", count: 2 },
        { range: "41-60%", count: 3 },
        { range: "61-80%", count: 4 },
        { range: "81-100%", count: 5 },
      ]);
    });
  });
});