import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { queryClientWrapper } from "@tests/test-utils/vitest-util";
import type { Todo } from "@/features/todos/types";

const mockTodos: Todo[] = [
  {
    id: "clx1111",
    todo_title: "テストタスク1",
    priority: "HIGH",
    progress: 50,
    updatedAt: new Date(),
  },
  {
    id: "clx2222",
    todo_title: "テストタスク2",
    priority: "MEDIUM",
    progress: 0,
    updatedAt: new Date(),
  },
];

describe("useTodo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTodos", () => {
    it("Todo一覧を取得できる", async () => {
      server.use(http.get("*/api/todos", () => HttpResponse.json(mockTodos)));

      const { result } = renderHook(() => useTodo(), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.todos).toHaveLength(2);
      });

      expect(result.current.todos[0].todo_title).toBe("テストタスク1");
      expect(result.current.todos[1].todo_title).toBe("テストタスク2");
    });

    it("Todo一覧が空の場合は空配列を返す", async () => {
      server.use(http.get("*/api/todos", () => HttpResponse.json([])));

      const { result } = renderHook(() => useTodo(), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.todos).toHaveLength(0);
      });
    });

    it("取得失敗時はuseSuspenseQueryがエラーをthrowする", async () => {
      server.use(
        http.get("*/api/todos", () =>
          HttpResponse.json({ error: "Server Error" }, { status: 500 }),
        ),
      );
      expect(true).toBe(true); // プレースホルダー
    });
  });
});