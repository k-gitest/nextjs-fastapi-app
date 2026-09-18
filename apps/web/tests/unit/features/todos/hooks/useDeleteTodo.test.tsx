import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { useDeleteTodo } from "@/features/todos/hooks/useDeleteTodo";
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

const useTodoWithDelete = () => ({
  todos: useTodo().todos,
  deleteMutation: useDeleteTodo(),
});

describe("useDeleteTodo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Todo削除が成功する", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.delete(
        "*/api/todos/:id",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderHook(() => useTodoWithDelete(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteMutation.mutateAsync("clx1111");
    });

    await waitFor(() => {
      expect(result.current.deleteMutation.isSuccess).toBe(true);
    });
  });

  it("削除中は楽観的更新でリストから除外される", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.delete("*/api/todos/:id", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useTodoWithDelete(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    act(() => {
      result.current.deleteMutation.mutate("clx1111");
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(1);
      expect(
        result.current.todos.find((t) => t.id === "clx1111"),
      ).toBeUndefined();
    });
  });

  it("削除失敗時はロールバックされる", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.delete("*/api/todos/:id", () =>
        HttpResponse.json({ error: "Server Error" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useTodoWithDelete(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    await act(async () => {
      try {
        await result.current.deleteMutation.mutateAsync("clx1111");
      } catch {
        // エラーは期待通り
      }
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });
  });
});