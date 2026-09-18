import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { useCreateTodo } from "@/features/todos/hooks/useCreateTodo";
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

const mockCreatedTodo: Todo = {
  id: "clxnew",
  todo_title: "新しいタスク",
  priority: "LOW",
  progress: 0,
  updatedAt: new Date(),
};

// useTodo（一覧）とuseCreateTodo（作成）は、実際のContainerと同じく
// 同一QueryClient配下で併用して初めて楽観的更新の効果を検証できる。
const useTodoWithCreate = () => ({
  todos: useTodo().todos,
  createMutation: useCreateTodo(),
});

describe("useCreateTodo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Todo作成が成功する", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.post("*/api/todos", () =>
        HttpResponse.json(mockCreatedTodo, { status: 201 }),
      ),
    );

    const { result } = renderHook(() => useTodoWithCreate(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    await act(async () => {
      await result.current.createMutation.mutateAsync({
        todo_title: "新しいタスク",
        priority: "LOW",
        progress: 0,
      });
    });

    await waitFor(() => {
      expect(result.current.createMutation.isSuccess).toBe(true);
    });
  });

  it("作成中は楽観的更新でリストに追加される", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.post("*/api/todos", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(mockCreatedTodo, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useTodoWithCreate(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    act(() => {
      result.current.createMutation.mutate({
        todo_title: "楽観的タスク",
        priority: "MEDIUM",
        progress: 0,
      });
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(3);
      expect(
        result.current.todos.some((t) => t.todo_title === "楽観的タスク"),
      ).toBe(true);
    });
  });

  it("作成失敗時はロールバックされる", async () => {
    server.use(
      http.get("*/api/todos", () => HttpResponse.json(mockTodos)),
      http.post("*/api/todos", () =>
        HttpResponse.json({ error: "Server Error" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useTodoWithCreate(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });

    await act(async () => {
      try {
        await result.current.createMutation.mutateAsync({
          todo_title: "失敗するタスク",
          priority: "HIGH",
          progress: 0,
        });
      } catch {
        // エラーは期待通り
      }
    });

    await waitFor(() => {
      expect(result.current.todos).toHaveLength(2);
    });
  });
});