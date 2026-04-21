import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { TodoEditModalContainer } from "@/features/todos/components/TodoEditModalContainer";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";
import { server } from "@tests/mocks/server";
import type { Todo } from "@/features/todos/types";

const mockOnClose = vi.fn();

const mockTodo: Todo = {
  id: "clx1234",
  todo_title: "既存のタスク",
  priority: "HIGH",
  progress: 50,
  userId: "user1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("TodoEditModalContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("モーダルが表示される", async () => {
    renderWithQueryClient(
      <TodoEditModalContainer todo={mockTodo} onClose={mockOnClose} />,
    );
    expect(await screen.findByText("タスクを編集")).toBeInTheDocument();
  });

  it("todoの既存値がフォームに反映される", async () => {
    renderWithQueryClient(
      <TodoEditModalContainer todo={mockTodo} onClose={mockOnClose} />,
    );
    expect(await screen.findByDisplayValue("既存のタスク")).toBeInTheDocument();
  });

  it("更新成功後にonCloseが呼ばれる", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <TodoEditModalContainer todo={mockTodo} onClose={mockOnClose} />,
    );

    const titleInput = await screen.findByDisplayValue("既存のタスク");
    await user.clear(titleInput);
    await user.type(titleInput, "更新されたタスク");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("更新失敗時はonCloseが呼ばれない", async () => {
    server.use(
      http.patch("*/api/todos/:id", () =>
        HttpResponse.json({ error: "Server Error" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderWithQueryClient(
      <TodoEditModalContainer todo={mockTodo} onClose={mockOnClose} />,
    );

    const titleInput = await screen.findByDisplayValue("既存のタスク");
    await user.clear(titleInput);
    await user.type(titleInput, "更新されたタスク");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  it("onOpenChange(false)でonCloseが呼ばれる", async () => {
    renderWithQueryClient(
      <TodoEditModalContainer todo={mockTodo} onClose={mockOnClose} />,
    );

    // まず表示を待つ
    await screen.findByText("タスクを編集");

    // Escキーなどで閉じる操作をシミュレート
    await userEvent.keyboard("{Escape}");

    // または、もし Container の Props を介して閉じているならその操作
    await waitFor(
      () => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
  });
});
