import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { useUpdateTodo } from "@/features/todos/hooks/useUpdateTodo";
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

const useTodoWithUpdate = () => ({
  todos: useTodo().todos,
  updateMutation: useUpdateTodo(),
});

describe("useUpdateTodo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Todo更新が成功する", async () => {
    const updatedTodo = { ...mockTodos[0], todo_title: "更新済みタスク" };
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.patch("*/api/todos/:id", () => HttpResponse.json(updatedTodo)),
    );

    const { result } = renderHook(() => useTodoWithUpdate(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    await act(async () => {
      await result.current.updateMutation.mutateAsync({
        id: "clx1111",
        todo_title: "更新済みタスク",
      });
    });

    await waitFor(() => {
      expect(result.current.updateMutation.isSuccess).toBe(true);
    });
  });

  it("更新中は楽観的更新でリストが更新される", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.patch("*/api/todos/:id", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({
          ...mockTodos[0],
          todo_title: "楽観的更新タスク",
        });
      }),
    );

    const { result } = renderHook(() => useTodoWithUpdate(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    act(() => {
      result.current.updateMutation.mutate({
        id: "clx1111",
        todo_title: "楽観的更新タスク",
      });
    });

    await waitFor(() => {
      expect(
        result.current.todos.find((t) => t.id === "clx1111")?.todo_title,
      ).toBe("楽観的更新タスク");
    });
  });

  it("更新失敗時はロールバックされる", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.patch("*/api/todos/:id", () =>
        HttpResponse.json({ error: "Server Error" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useTodoWithUpdate(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    await act(async () => {
      try {
        await result.current.updateMutation.mutateAsync({
          id: "clx1111",
          todo_title: "失敗する更新",
        });
      } catch {
        // エラーは期待通り
      }
    });

    await waitFor(() => {
      expect(
        result.current.todos.find((t) => t.id === "clx1111")?.todo_title,
      ).toBe("テストタスク1");
    });
  });
});