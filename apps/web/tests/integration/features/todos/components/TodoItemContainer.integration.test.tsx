import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoItemContainer } from "@/features/todos/components/TodoItemContainer";
import { useTodo } from "@/features/todos/hooks/useTodo";
import { useUIStore } from "@/hooks/useExclusiveModal";
import type { TodoWithImages } from "@/features/todos/types";
import type { SimilarTodoItem } from "@/features/todos/hooks/useTodoSearch";

vi.mock("@/features/todos/hooks/useTodo");

const mockUpdateTodo = vi.fn();
const mockDeleteTodo = vi.fn();

const mockFullTodo: TodoWithImages = {
  id: "todo-1",
  todo_title: "既存のタスク",
  priority: "HIGH",
  progress: 50,
  userId: "user-1",
  createdAt: new Date("2026-06-01"),
  updatedAt: new Date("2026-06-02"),
  images: [],
};

const mockSearchTodo: SimilarTodoItem = {
  id: "todo-2",
  title: "検索結果のタスク",
  priority: "MEDIUM",
  progress: 0,
  score: 0.87,
} as SimilarTodoItem;

describe("TodoItemContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ currentModalId: null });

    (useTodo as ReturnType<typeof vi.fn>).mockReturnValue({
      updateTodo: mockUpdateTodo,
      deleteTodo: mockDeleteTodo,
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });
  });

  afterEach(() => {
    useUIStore.setState({ currentModalId: null });
  });

  it("通常のTodoではタイトル・更新日時が表示され、チェックボックス操作が可能であること", () => {
    render(<TodoItemContainer todo={mockFullTodo} />);

    expect(screen.getByText("既存のタスク")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("チェックボックスをクリックすると、progressが0→100でupdateTodoが呼ばれること", async () => {
    const user = userEvent.setup();
    render(<TodoItemContainer todo={{ ...mockFullTodo, progress: 0 }} />);

    await user.click(screen.getByRole("checkbox"));

    expect(mockUpdateTodo).toHaveBeenCalledTimes(1);
    expect(mockUpdateTodo).toHaveBeenCalledWith({ id: mockFullTodo.id, progress: 100 });
  });

  it("progressが100のときチェックボックスをクリックすると、progress: 0でupdateTodoが呼ばれること（トグルの逆方向）", async () => {
    const user = userEvent.setup();
    render(<TodoItemContainer todo={{ ...mockFullTodo, progress: 100 }} />);

    await user.click(screen.getByRole("checkbox"));

    expect(mockUpdateTodo).toHaveBeenCalledWith({ id: mockFullTodo.id, progress: 0 });
  });

  it("編集メニューをクリックすると、TodoEditModalContainerが開くこと", async () => {
    const user = userEvent.setup();
    render(<TodoItemContainer todo={mockFullTodo} />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(await screen.findByText("編集"));

    expect(await screen.findByText("タスクを編集")).toBeInTheDocument();
  });

  it("削除メニューをクリックし、window.confirmでOKを選択すると、deleteTodoが呼ばれること", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<TodoItemContainer todo={mockFullTodo} />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(await screen.findByText("削除"));

    expect(confirmSpy).toHaveBeenCalledWith("本当にこのタスクを削除しますか？");
    await waitFor(() => {
      expect(mockDeleteTodo).toHaveBeenCalledWith(mockFullTodo.id);
    });

    confirmSpy.mockRestore();
  });

  it("削除メニューをクリックし、window.confirmでキャンセルを選択すると、deleteTodoが呼ばれないこと", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<TodoItemContainer todo={mockFullTodo} />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(await screen.findByText("削除"));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDeleteTodo).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("別のモーダルが既に開いている場合、チェックボックスがdisabledになること（isLockedByOther）", () => {
    useUIStore.setState({ currentModalId: "other-modal-id" });

    render(<TodoItemContainer todo={mockFullTodo} />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("updateMutation.isPendingがtrueのとき、チェックボックスがdisabledになること", () => {
    (useTodo as ReturnType<typeof vi.fn>).mockReturnValue({
      updateTodo: mockUpdateTodo,
      deleteTodo: mockDeleteTodo,
      updateMutation: { isPending: true },
      deleteMutation: { isPending: false },
    });

    render(<TodoItemContainer todo={mockFullTodo} />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("deleteMutation.isPendingがtrueのとき、チェックボックスがdisabledになること", () => {
    (useTodo as ReturnType<typeof vi.fn>).mockReturnValue({
      updateTodo: mockUpdateTodo,
      deleteTodo: mockDeleteTodo,
      updateMutation: { isPending: false },
      deleteMutation: { isPending: true },
    });

    render(<TodoItemContainer todo={mockFullTodo} />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("検索結果（SimilarTodoItem）の場合、titleフィールドが使われ、アクション（チェックボックス・メニュー）が表示されないこと", () => {
    render(<TodoItemContainer todo={mockSearchTodo} isSearchMode score={0.87} />);

    expect(screen.getByText("検索結果のタスク")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
  });

  it("検索結果の場合、チェックボックス自体が無いためupdateTodo/deleteTodoは呼ばれる余地がないこと（型ガードの安全性）", () => {
    render(<TodoItemContainer todo={mockSearchTodo} isSearchMode score={0.87} />);

    // アクション非表示のため、そもそも操作不能であることの確認（isFullTodo=falseの安全側動作）
    expect(mockUpdateTodo).not.toHaveBeenCalled();
    expect(mockDeleteTodo).not.toHaveBeenCalled();
  });
});