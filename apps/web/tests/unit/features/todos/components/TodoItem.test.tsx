import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { TodoItem } from "@/features/todos/components/TodoItem";

describe("TodoItem", () => {
  const defaultProps = {
    id: "1",
    title: "テストタスク",
    priority: "MEDIUM" as const,
    progress: 50,
    updatedAt: new Date("2026-04-01"),
    onToggleComplete: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  it("基本的な情報（タイトル、優先度、進捗）が表示されること", () => {
    render(<TodoItem {...defaultProps} />);

    expect(screen.getByText("テストタスク")).toBeInTheDocument();
    expect(screen.getByText("中")).toBeInTheDocument(); // MEDIUM -> 中
    expect(screen.getByText("進捗: 50%")).toBeInTheDocument();
  });

  it("progressが100のとき、完了状態のスタイル（打ち消し線）が適用されること", () => {
    render(<TodoItem {...defaultProps} progress={100} />);

    const titleElement = screen.getByText("テストタスク").parentElement;
    expect(titleElement).toHaveClass("line-through");

    // Checkboxがチェックされていること
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("優先度（HIGH）のとき、destructiveバリアントのバッジが表示されること", () => {
    render(<TodoItem {...defaultProps} priority="HIGH" />);
    const badge = screen.getByText("高");
    // クラス名ではなく、バリアントが正しく適用されているかを確認
    expect(badge).toHaveAttribute("data-variant", "destructive");
  });

  it("チェックボックスをクリックすると onToggleComplete が呼ばれること", async () => {
    const user = userEvent.setup();
    render(<TodoItem {...defaultProps} />);

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(defaultProps.onToggleComplete).toHaveBeenCalledTimes(1);
  });

  it("ドロップダウンメニューから編集・削除を実行できること", async () => {
    const user = userEvent.setup();
    render(<TodoItem {...defaultProps} />);

    // 1. メニューを開くボタンをクリック
    const menuTrigger = screen.getByRole("button", { name: /open menu/i });
    await user.click(menuTrigger);

    // 2. 「編集」をクリック
    const editItem = await screen.findByText("編集");
    await user.click(editItem);
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1);

    // 3. メニューを再度開いて「削除」をクリック
    await user.click(menuTrigger);
    const deleteItem = await screen.findByText("削除");
    await user.click(deleteItem);
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it("showActionsがfalseのとき、アクション系UIが表示されないこと", () => {
    render(<TodoItem {...defaultProps} showActions={false} />);

    // チェックボックスが存在しないこと
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    // メニューを開くボタンが存在しないこと
    expect(
      screen.queryByRole("button", { name: /open menu/i }),
    ).not.toBeInTheDocument();
  });

  it("disabledがtrueのとき、カードが半透明になり操作不能になること", () => {
    const { container } = render(
      <TodoItem {...defaultProps} disabled={true} />,
    );

    // Cardのルート要素に特定のクラスが付与されているか（実装に合わせて調整）
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("opacity-50");
    expect(card).toHaveClass("pointer-events-none");

    // チェックボックスも無効化されていること
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
