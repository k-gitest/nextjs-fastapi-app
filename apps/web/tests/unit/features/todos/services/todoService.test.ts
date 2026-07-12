import { describe, it, expect, vi, beforeEach } from "vitest";
import { todoService } from "@/features/todos/services/todoService";
import { prisma } from "@/lib/prisma";
import { Priority } from "@repo/db";
import type { TodoWithImages } from "@/features/todos/types";

// ── tx モックを module スコープで保持 ──────────────────────────────────────────
// vi.mock は hoisting されるため、ファクトリ内では外部変数を参照できない。
// mockTx は beforeEach の mockImplementation 経由で $transaction に渡す。
const mockTxTodo = {
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockTxOutboxEvents = {
  create: vi.fn(),
};
const mockTx = {
  todo: mockTxTodo,
  outbox_events: mockTxOutboxEvents,
};

// prisma クライアントのモック化
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    todo: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

describe("todoService", () => {
  const userId = "user1";
  const now = new Date();

  // NOTE: todoService.getTodos/deleteTodo が images を include するようになったため、
  // Todo（プレーンなPrisma型）ではなく TodoWithImages を共有フィクスチャの型として使う。
  // create/update系のテストはimagesの有無を検証していないため、この変更で壊れない。
  const baseTodo: TodoWithImages = {
    id: "clx1234",
    todo_title: "テストタスク",
    priority: "HIGH",
    progress: 50,
    userId,
    createdAt: now,
    updatedAt: now,
    images: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction のシムを毎回リセット後も維持する
    vi.mocked(prisma.$transaction).mockImplementation(
      ((cb: (tx: typeof mockTx) => Promise<unknown>) =>
        cb(mockTx)) as unknown as typeof prisma.$transaction
    );
  });

  // ── getTodos ────────────────────────────────────────────────────────────────

  describe("getTodos", () => {
    it("指定したuserIdのTodoを取得し、作成日順でソートされ、imagesはorder昇順でincludeされること", async () => {
      const mockTodos: TodoWithImages[] = [baseTodo];
      vi.mocked(prisma.todo.findMany).mockResolvedValue(mockTodos);

      const result = await todoService.getTodos(userId);

      // 複数添付対応（Phase2）で images の include に orderBy: { order: "asc" } が追加された。
      // 表示順を保証するための変更のため、ここで固定してリグレッションを検知する。
      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { images: { orderBy: { order: "asc" } } },
      });
      expect(result).toEqual(mockTodos);
    });
  });

  // ── createTodo ──────────────────────────────────────────────────────────────

  describe("createTodo", () => {
    it("$transactionが呼ばれること", async () => {
      const input = {
        todo_title: "新しいタスク",
        userId,
        priority: Priority.MEDIUM,
        progress: 0,
      };
      mockTxTodo.create.mockResolvedValueOnce({ ...baseTodo, ...input });
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.createTodo(input, "test-correlation-id");

      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it("正しいデータでTodoが作成されること", async () => {
      const input = {
        todo_title: "新しいタスク",
        userId,
        priority: Priority.MEDIUM,
        progress: 0,
      };
      const created = { ...baseTodo, ...input };
      mockTxTodo.create.mockResolvedValueOnce(created);
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      const result = await todoService.createTodo(input, "test-correlation-id");

      expect(mockTxTodo.create).toHaveBeenCalledWith({ data: input });
      expect(result.todo_title).toBe("新しいタスク");
    });

    it("outbox_eventsにevent_type=todo.createdが書き込まれること", async () => {
      const input = {
        todo_title: "新しいタスク",
        userId,
        priority: Priority.MEDIUM,
        progress: 0,
      };
      mockTxTodo.create.mockResolvedValueOnce({ ...baseTodo, ...input });
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.createTodo(input, "test-correlation-id");

      expect(mockTxOutboxEvents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "todo.created",
            idempotency_key: `todo.created:${baseTodo.id}`,
          }),
        })
      );
    });
  });

  // ── updateTodo ──────────────────────────────────────────────────────────────

  describe("updateTodo", () => {
    it("IDを除いたデータが更新用パラメータとして渡されること", async () => {
      const input = { id: "clx1234", todo_title: "更新済み", progress: 100 };
      const updated = { ...baseTodo, ...input };
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo); // ownership check
      mockTxTodo.update.mockResolvedValueOnce(updated);
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.updateTodo(input, userId, "test-correlation-id");

      expect(mockTxTodo.update).toHaveBeenCalledWith({
        where: { id: "clx1234" },
        data: { todo_title: "更新済み", progress: 100 },
      });
    });

    it("ownership checkで所有者のTodoを検索すること", async () => {
      const input = { id: "clx1234", todo_title: "更新済み", progress: 100 };
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo);
      mockTxTodo.update.mockResolvedValueOnce({ ...baseTodo, ...input });
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.updateTodo(input, userId, "test-correlation-id");

      expect(mockTxTodo.findFirst).toHaveBeenCalledWith({
        where: { id: "clx1234", userId },
      });
    });

    it("所有者でないTodoはNotFoundErrorをthrowすること", async () => {
      const input = { id: "clx1234", todo_title: "更新済み", progress: 100 };
      mockTxTodo.findFirst.mockResolvedValueOnce(null); // 存在しない / 別ユーザー

      await expect(todoService.updateTodo(input, userId, "test-correlation-id")).rejects.toThrow(
        "Todo not found or unauthorized"
      );
    });

    it("outbox_eventsにevent_type=todo.updatedが書き込まれること", async () => {
      const input = { id: "clx1234", todo_title: "更新済み", progress: 100 };
      const updated = { ...baseTodo, ...input };
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo);
      mockTxTodo.update.mockResolvedValueOnce(updated);
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.updateTodo(input, userId, "test-correlation-id");

      expect(mockTxOutboxEvents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "todo.updated",
          }),
        })
      );
    });
  });

  // ── deleteTodo ──────────────────────────────────────────────────────────────

  describe("deleteTodo", () => {
    it("所有者のTodoを削除できること", async () => {
      // deleteTodo は existing.images からB2クリーンアップ対象キーを収集するため、
      // findFirst の戻り値には images（空配列でも可）が必要
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo);
      mockTxTodo.delete.mockResolvedValueOnce(baseTodo);
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.deleteTodo("clx1234", userId, "test-correlation-id");

      expect(mockTxTodo.delete).toHaveBeenCalledWith({
        where: { id: "clx1234" },
      });
    });

    it("所有者でないTodoはNotFoundErrorをthrowすること", async () => {
      mockTxTodo.findFirst.mockResolvedValueOnce(null);

      await expect(todoService.deleteTodo("clx1234", userId, "test-correlation-id")).rejects.toThrow(
        "Todo not found or unauthorized"
      );
    });

    it("outbox_eventsにevent_type=todo.deletedが書き込まれること", async () => {
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo);
      mockTxTodo.delete.mockResolvedValueOnce(baseTodo);
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.deleteTodo("clx1234", userId, "test-correlation-id");

      expect(mockTxOutboxEvents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "todo.deleted",
            idempotency_key: `todo.deleted:${baseTodo.id}`,
          }),
        })
      );
    });
  });

  // ── getTodoStats ────────────────────────────────────────────────────────────

  describe("getTodoStats", () => {
    it("groupByの結果をフロントエンド用の形式に変換すること", async () => {
      const mockGroupResult = [
        { priority: Priority.HIGH, _count: { priority: 1 } },
        { priority: Priority.MEDIUM, _count: { priority: 1 } },
        { priority: Priority.LOW, _count: { priority: 2 } },
      ];
      vi.mocked(prisma.todo.groupBy).mockResolvedValue(
        mockGroupResult as unknown as never
      );

      const result = await todoService.getTodoStats(userId);

      expect(result).toEqual([
        { priority: "HIGH", count: 1 },
        { priority: "MEDIUM", count: 1 },
        { priority: "LOW", count: 2 },
      ]);
    });
  });

  // ── getProgressStats ────────────────────────────────────────────────────────

  describe("getProgressStats", () => {
    it("進捗率に基づいて、todoHandlersと同じ期待値の分布を返すこと", async () => {
      const mockTodos = [
        { progress: 10 }, // 0-20%
        { progress: 50 }, // 41-60%
        { progress: 90 }, // 81-100%
      ];
      vi.mocked(prisma.todo.findMany).mockResolvedValue(
        mockTodos as unknown as TodoWithImages[]
      );

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