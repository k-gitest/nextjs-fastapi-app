import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoEditModal } from "@/features/todos/components/TodoEditModal";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";

const mockOnSubmit = vi.fn();
const mockOnOpenChange = vi.fn();

const defaultProps = {
  id: "clx1234",
  title: "既存のタスク",
  priority: "HIGH" as const,
  progress: 50,
  open: true,
  onOpenChange: mockOnOpenChange,
  onSubmit: mockOnSubmit,
};

describe("TodoEditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("open=trueの時にモーダルが表示される", () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);
    expect(screen.getByText("タスクを編集")).toBeInTheDocument();
  });

  it("open=falseの時はモーダルが表示されない", () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} open={false} />);
    expect(screen.queryByText("タスクを編集")).not.toBeInTheDocument();
  });

  it("デフォルト値がフォームに反映される", () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);
    expect(screen.getByDisplayValue("既存のタスク")).toBeInTheDocument();
  });

  it("isSubmitting=trueの時は送信ボタンが「保存中...」になる", () => {
    renderWithQueryClient(
      <TodoEditModal {...defaultProps} isSubmitting={true} />
    );
    expect(
      screen.getByRole("button", { name: "保存中..." })
    ).toBeInTheDocument();
  });

  it("isSubmitting=falseの時は送信ボタンが「変更を保存」になる", () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "変更を保存" })
    ).toBeInTheDocument();
  });

  it("フォーム送信でonSubmitが呼ばれる", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);

    const titleInput = screen.getByDisplayValue("既存のタスク");
    await user.clear(titleInput);
    await user.type(titleInput, "更新されたタスク");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ todo_title: "更新されたタスク" })
      );
    });
  });
});