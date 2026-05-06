import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerVectorUpsert, triggerVectorDelete } from "@/features/todos/services/vector-trigger";
import { qstashClient } from "@/lib/qstash";
import type { Todo } from "@repo/db";

vi.mock("@/lib/qstash", () => ({
  qstashClient: {
    publishJSON: vi.fn(),
  },
}));

describe("vectorIndexingService", () => {
  const FASTAPI_PUBLIC_URL = "https://example.fastapi.dev";
  const now = new Date("2024-01-01T00:00:00.000Z");

  const baseTodo: Todo = {
    id: "clx1234",
    todo_title: "テストタスク",
    priority: "HIGH",
    progress: 50,
    userId: "user1",
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // process.env への代入はモジュールが既にロード済みの場合に反映されないため
    // vi.stubEnv で確実に環境変数を注入する
    vi.stubEnv("FASTAPI_PUBLIC_URL", FASTAPI_PUBLIC_URL);
  });

  describe("triggerVectorUpsert", () => {
    it("正しいエンドポイントURLでpublishJSONが呼ばれること", async () => {
      vi.mocked(qstashClient.publishJSON).mockResolvedValue({ messageId: "msg1" });

      await triggerVectorUpsert(baseTodo);

      expect(qstashClient.publishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${FASTAPI_PUBLIC_URL}/webhooks/vector-indexing`,
        })
      );
    });

    it("operation が upsert としてbodyに含まれること", async () => {
      vi.mocked(qstashClient.publishJSON).mockResolvedValue({ messageId: "msg1" });

      await triggerVectorUpsert(baseTodo);

      expect(qstashClient.publishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ operation: "upsert" }),
        })
      );
    });

    it("Todoの各フィールドが正しくbodyにマッピングされること", async () => {
      vi.mocked(qstashClient.publishJSON).mockResolvedValue({ messageId: "msg1" });

      await triggerVectorUpsert(baseTodo);

      expect(qstashClient.publishJSON).toHaveBeenCalledWith({
        url: `${FASTAPI_PUBLIC_URL}/webhooks/vector-indexing`,
        body: {
          todo_id: baseTodo.id,
          operation: "upsert",
          todo_title: baseTodo.todo_title,
          priority: baseTodo.priority,
          progress: baseTodo.progress,
          user_id: baseTodo.userId,
          created_at: baseTodo.createdAt.toISOString(),
        },
      });
    });

    it("createdAt が ISO 8601 文字列に変換されること", async () => {
      vi.mocked(qstashClient.publishJSON).mockResolvedValue({ messageId: "msg1" });

      await triggerVectorUpsert(baseTodo);

      const call = vi.mocked(qstashClient.publishJSON).mock.calls[0][0] as {
        body: { created_at: string };
      };
      expect(call.body.created_at).toBe("2024-01-01T00:00:00.000Z");
    });

    it("publishJSONが失敗した場合、エラーがそのままスローされること", async () => {
      const error = new Error("QStash publish failed");
      vi.mocked(qstashClient.publishJSON).mockRejectedValue(error);

      await expect(triggerVectorUpsert(baseTodo)).rejects.toThrow("QStash publish failed");
    });
  });

  describe("triggerVectorDelete", () => {
    const todoId = "clx1234";

    it("正しいエンドポイントURLでpublishJSONが呼ばれること", async () => {
      vi.mocked(qstashClient.publishJSON).mockResolvedValue({ messageId: "msg2" });

      await triggerVectorDelete(todoId);

      expect(qstashClient.publishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${FASTAPI_PUBLIC_URL}/webhooks/vector-indexing`,
        })
      );
    });

    it("operation が delete としてbodyに含まれること", async () => {
      vi.mocked(qstashClient.publishJSON).mockResolvedValue({ messageId: "msg2" });

      await triggerVectorDelete(todoId);

      expect(qstashClient.publishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ operation: "delete" }),
        })
      );
    });

    it("todo_id と operation のみがbodyに含まれること", async () => {
      vi.mocked(qstashClient.publishJSON).mockResolvedValue({ messageId: "msg2" });

      await triggerVectorDelete(todoId);

      expect(qstashClient.publishJSON).toHaveBeenCalledWith({
        url: `${FASTAPI_PUBLIC_URL}/webhooks/vector-indexing`,
        body: {
          todo_id: todoId,
          operation: "delete",
        },
      });
    });

    it("publishJSONが失敗した場合、エラーがそのままスローされること", async () => {
      const error = new Error("QStash publish failed");
      vi.mocked(qstashClient.publishJSON).mockRejectedValue(error);

      await expect(triggerVectorDelete(todoId)).rejects.toThrow("QStash publish failed");
    });
  });
});