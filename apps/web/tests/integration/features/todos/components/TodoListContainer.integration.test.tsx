import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TodoListContainer } from "@/features/todos/components/TodoListContainer";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { useTodoSearch } from "@/features/todos/hooks/useTodoSearch";
import { useTodoSearchState } from "@/features/todos/hooks/useTodoSearchState";
import { useExclusiveModal, useUIStore } from "@/hooks/useExclusiveModal";
import type { Todo } from "@/features/todos/types";

vi.mock("@/features/todos/hooks/useTodo");
vi.mock("@/features/todos/hooks/useTodoSearch");
vi.mock("@/features/todos/hooks/useTodoSearchState");
vi.mock("@/hooks/useExclusiveModal");

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("TodoList", () => {
  const mockTodos: Todo[] = [
    {
      id: "1",
      todo_title: "タスク1",
      priority: "HIGH",
      progress: 0,
      updatedAt: new Date(),
    },
    {
      id: "2",
      todo_title: "タスク2",
      priority: "MEDIUM",
      progress: 50,
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    (useTodo as Mock).mockReturnValue({
      todos: [],
      updateTodo: vi.fn(),
      deleteTodo: vi.fn(),
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    (useTodoSearchState as unknown as Mock).mockReturnValue({
      searchQuery: "",
      setSearchQuery: vi.fn(),
    });

    (useTodoSearch as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    (useExclusiveModal as Mock).mockReturnValue({
      isOpen: false,
      open: vi.fn(),
      close: vi.fn(),
    });

    (useUIStore as unknown as Mock).mockReturnValue(false);
  });

  it("タスクが空のとき、メッセージが表示されること", () => {
    renderWithQueryClient(<TodoListContainer />);
    expect(screen.getByText(/タスクが見つかりません/)).toBeInTheDocument();
  });

  it("タスクが存在するとき、リストが表示されること", () => {
    (useTodo as Mock).mockReturnValue({
      todos: mockTodos,
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    renderWithQueryClient(<TodoListContainer />);

    expect(screen.getByText("タスク1")).toBeInTheDocument();
    expect(screen.getByText("タスク2")).toBeInTheDocument();
  });

  it("limit プロップスが指定された場合、その件数のみ表示されること", () => {
    (useTodo as Mock).mockReturnValue({
      todos: mockTodos,
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    renderWithQueryClient(<TodoListContainer limit={1} />);

    expect(screen.getByText("タスク1")).toBeInTheDocument();
    expect(screen.queryByText("タスク2")).not.toBeInTheDocument();
  });

  it("showActions が true のとき、フィルタUIのチェックボックスが表示されること", () => {
    (useTodo as Mock).mockReturnValue({
      todos: [mockTodos[0]],
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    renderWithQueryClient(<TodoListContainer showActions={true} />);

    // 完了フィルタのチェックボックスのみを対象にする（TodoItem側の
    // 完了トグルは別要素のため、idで一意に絞る）
    expect(document.getElementById("todo-completed-only")).toBeInTheDocument();
  });

  it("showActions が false のとき、フィルタUI自体が表示されないこと", () => {
    (useTodo as Mock).mockReturnValue({
      todos: [mockTodos[0]],
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    renderWithQueryClient(<TodoListContainer showActions={false} />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("タスク1")).toBeInTheDocument();
  });

  it("検索モードのとき、検索結果ヘッダーが表示されること", () => {
    (useTodoSearchState as unknown as Mock).mockReturnValue({
      searchQuery: "テスト",
      setSearchQuery: vi.fn(),
    });
    (useTodoSearch as Mock).mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });

    renderWithQueryClient(<TodoListContainer />);

    expect(screen.getByText(/「テスト」の関連タスク/)).toBeInTheDocument();
  });
});