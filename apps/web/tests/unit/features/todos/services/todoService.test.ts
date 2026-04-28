import { describe, it, expect, vi, beforeEach } from "vitest";
import { todoService } from "@/features/todos/services/todoService";
import { prisma } from "@/lib/prisma";
import { Priority, type Todo } from "@repo/db";

// prisma クライアントのモック化
vi.mock("@/lib/prisma", () => ({
  prisma: {
    todo: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

describe("todoService", () => {
  const userId = "user1";
  const now = new Date();

  // 共通のベースTodoオブジェクト（型安全のため）
  const baseTodo: Todo = {
    id: "clx1234",
    todo_title: "テストタスク",
    priority: "HIGH",
    progress: 50,
    userId: userId,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTodos", () => {
    it("指定したuserIdのTodoを取得し、作成日順でソートされること", async () => {
      const mockTodos: Todo[] = [baseTodo];
      vi.mocked(prisma.todo.findMany).mockResolvedValue(mockTodos);

      const result = await todoService.getTodos(userId);

      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockTodos);
    });
  });

  describe("createTodo", () => {
    it("正しいデータでTodoが作成されること", async () => {
      const input = {
        todo_title: "新しいタスク",
        userId,
        priority: Priority.MEDIUM,
        progress: 0,
      };
      vi.mocked(prisma.todo.create).mockResolvedValue({ ...baseTodo, ...input });

      const result = await todoService.createTodo(input);

      expect(prisma.todo.create).toHaveBeenCalledWith({ data: input });
      expect(result.todo_title).toBe("新しいタスク");
    });
  });

  describe("updateTodo", () => {
    it("IDを除いたデータが更新用パラメータとして渡されること", async () => {
      const input = { id: "clx1234", todo_title: "更新済み", progress: 100 };
      vi.mocked(prisma.todo.update).mockResolvedValue({ ...baseTodo, ...input });

      await todoService.updateTodo(input);

      expect(prisma.todo.update).toHaveBeenCalledWith({
        where: { id: "clx1234" },
        data: { todo_title: "更新済み", progress: 100 },
      });
    });
  });

  describe("getTodoStats", () => {
    it("groupByの結果をフロントエンド用の形式に変換すること", async () => {
      // PrismaのgroupByが返す実際の構造に合わせる
      const mockGroupResult = [
        { priority: Priority.HIGH, _count: { priority: 1 } },
        { priority: Priority.MEDIUM, _count: { priority: 1 } },
        { priority: Priority.LOW, _count: { priority: 2 } },
      ];
      // groupByは特殊な型を返すため、必要最小限のプロパティでモック
      vi.mocked(prisma.todo.groupBy).mockResolvedValue(mockGroupResult as unknown as never);

      const result = await todoService.getTodoStats(userId);

      expect(result).toEqual([
        { priority: "HIGH", count: 1 },
        { priority: "MEDIUM", count: 1 },
        { priority: "LOW", count: 2 },
      ]);
    });
  });

  describe("getProgressStats", () => {
    it("進捗率に基づいて、todoHandlersと同じ期待値の分布を返すこと", async () => {
      // todoHandlers の出力に合わせたデータを用意
      const mockTodos = [
        { progress: 10 }, // 0-20%
        { progress: 50 }, // 41-60%
        { progress: 90 }, // 81-100%
      ];
      vi.mocked(prisma.todo.findMany).mockResolvedValue(mockTodos as unknown as Todo[]);

      const result = await todoService.getProgressStats(userId);

      expect(result).toEqual([
        { range: "0-20%", count: 1 },
        { range: "21-40%", count: 0 },
        { range: "41-60%", count: 1 },
        { range: "61-80%", count: 0 },
        { range: "81-100%", count: 1 },
      ]);
    });
  });
});