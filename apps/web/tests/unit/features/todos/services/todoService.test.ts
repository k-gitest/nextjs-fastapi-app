import { describe, it, expect, vi, beforeEach } from "vitest";
import { todoService } from "@/features/todos/services/todoService";
import { prisma } from "@/lib/prisma";
import { Priority } from "@repo/db";
import type { TodoWithImages } from "@/features/todos/types";
import { ValidationError } from "@/errors/validation-error";

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

  // NOTE: todoService.getTodos が images を include するようになったため、
  // Todo（プレーンなPrisma型）ではなく TodoWithImages を共有フィクスチャの型として使う。
  // create/update/delete系のテストはimagesの有無を検証していないため、この変更で壊れない。
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
    it("指定したuserIdのTodoを取得し、todoImages→imagesへDTO変換され、orderはTodoImage.orderで上書きされること", async () => {
      // Image.order（5）はmigration時点で凍結された古い値。
      // 表示順の正はTodoImage.order（0）であり、DTO変換でこちらが優先されることを確認する。
      const rawTodo = {
        id: baseTodo.id,
        todo_title: baseTodo.todo_title,
        priority: baseTodo.priority,
        progress: baseTodo.progress,
        userId: baseTodo.userId,
        createdAt: baseTodo.createdAt,
        updatedAt: baseTodo.updatedAt,
        todoImages: [
          {
            id: "ti-1",
            todoId: baseTodo.id,
            imageId: "img-1",
            order: 0,
            createdAt: now,
            image: {
              id: "img-1",
              todoId: baseTodo.id,
              storageKey: "uploads/x.jpg",
              originalFileName: "x.jpg",
              mimeType: "image/jpeg",
              fileSize: 1024,
              order: 5, // 凍結された旧値。DTOでは参照されないはず
              albumId: null,
              createdAt: now,
              updatedAt: now,
            },
          },
        ],
      };

      vi.mocked(prisma.todo.findMany).mockResolvedValue([rawTodo] as unknown as never);

      const result = await todoService.getTodos(userId);

      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          todoImages: {
            orderBy: { order: "asc" },
            include: { image: true },
          },
        },
      });

      expect(result).toEqual([
        {
          id: baseTodo.id,
          todo_title: baseTodo.todo_title,
          priority: baseTodo.priority,
          progress: baseTodo.progress,
          userId: baseTodo.userId,
          createdAt: baseTodo.createdAt,
          updatedAt: baseTodo.updatedAt,
          images: [
            {
              id: "img-1",
              originalFileName: "x.jpg",
              mimeType: "image/jpeg",
              fileSize: 1024,
              order: 0, // ti.orderで上書きされ、Image.orderの5ではないこと
            },
          ],
        },
      ]);
    });

    it("Prismaのimageオブジェクトを丸ごとスプレッドせず、storageKey等のPrisma内部表現を含めないこと（Issue #27の境界確認）", async () => {
      const rawTodo = {
        id: baseTodo.id,
        todo_title: baseTodo.todo_title,
        priority: baseTodo.priority,
        progress: baseTodo.progress,
        userId: baseTodo.userId,
        createdAt: baseTodo.createdAt,
        updatedAt: baseTodo.updatedAt,
        todoImages: [
          {
            id: "ti-1",
            order: 0,
            image: {
              id: "img-1",
              storageKey: "uploads/x.jpg",
              originalFileName: "x.jpg",
              mimeType: "image/jpeg",
              fileSize: 1024,
              order: 5,
              albumId: "album-1",
              userId: "some-other-user-id",
              createdAt: now,
              updatedAt: now,
            },
          },
        ],
      };

      vi.mocked(prisma.todo.findMany).mockResolvedValue([rawTodo] as unknown as never);

      const result = await todoService.getTodos(userId);

      expect(result[0].images[0]).not.toHaveProperty("storageKey");
      expect(result[0].images[0]).not.toHaveProperty("albumId");
      expect(result[0].images[0]).not.toHaveProperty("userId");
      expect(result[0].images[0]).not.toHaveProperty("createdAt");
      expect(result[0].images[0]).not.toHaveProperty("updatedAt");
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

    it("todo_titleが空文字の場合、ValidationErrorをthrowし$transactionは呼ばれないこと", async () => {
      const input = {
        todo_title: "",
        userId,
        priority: Priority.MEDIUM,
        progress: 0,
      };

      await expect(todoService.createTodo(input, "test-correlation-id")).rejects.toThrow(
        ValidationError,
      );
      await expect(todoService.createTodo(input, "test-correlation-id")).rejects.toThrow(
        "タイトルを入力してください",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("priority/progressが未指定の場合、MEDIUM/0として正規化された上でTodoが作成されること（既存のPrisma Default依存からの回帰確認）", async () => {
      const input = { todo_title: "タスク", userId };
      mockTxTodo.create.mockResolvedValueOnce({
        ...baseTodo,
        todo_title: "タスク",
        priority: Priority.MEDIUM,
        progress: 0,
      });
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.createTodo(input, "test-correlation-id");

      expect(mockTxTodo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          todo_title: "タスク",
          priority: Priority.MEDIUM,
          progress: 0,
        }),
      });
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

    it("todo_titleが256文字の場合、ValidationErrorをthrowしownership checkは呼ばれないこと", async () => {
      const input = { id: "clx1234", todo_title: "a".repeat(256) };

      await expect(
        todoService.updateTodo(input, userId, "test-correlation-id"),
      ).rejects.toThrow(ValidationError);
      expect(mockTxTodo.findFirst).not.toHaveBeenCalled();
    });

    it("progressが未指定の場合、更新データに含まれず既存値が維持されること", async () => {
      const input = { id: "clx1234", todo_title: "更新済み" };
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo);
      mockTxTodo.update.mockResolvedValueOnce({ ...baseTodo, todo_title: "更新済み" });
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.updateTodo(input, userId, "test-correlation-id");

      expect(mockTxTodo.update).toHaveBeenCalledWith({
        where: { id: "clx1234" },
        data: { todo_title: "更新済み" }, // progressは含まれない
      });
    });
  });

  // ── deleteTodo ──────────────────────────────────────────────────────────────

  describe("deleteTodo", () => {
    it("所有者のTodoを削除できること", async () => {
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo);
      mockTxTodo.delete.mockResolvedValueOnce(baseTodo);
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.deleteTodo("clx1234", userId, "test-correlation-id");

      expect(mockTxTodo.delete).toHaveBeenCalledWith({
        where: { id: "clx1234" },
      });
    });

    it("Todo削除時にImageを取得しないこと", async () => {
      // Image本体・B2はdeleteTodoの責務ではなくなったため、
      // findFirstはtodoImages/imageをincludeしない設計であることを確認する
      // （Image Ownership Principle・updateTodoのdetach挙動との整合）
      mockTxTodo.findFirst.mockResolvedValueOnce(baseTodo);
      mockTxTodo.delete.mockResolvedValueOnce(baseTodo);
      mockTxOutboxEvents.create.mockResolvedValueOnce({});

      await todoService.deleteTodo("clx1234", userId, "test-correlation-id");

      expect(mockTxTodo.findFirst).toHaveBeenCalledWith({
        where: { id: "clx1234", userId },
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