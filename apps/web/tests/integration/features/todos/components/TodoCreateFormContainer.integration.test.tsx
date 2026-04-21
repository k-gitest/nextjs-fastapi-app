import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoCreateFormContainer } from "@/features/todos/components/TodoCreateFormContainer";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";
import { server } from "@tests/mocks/server";
import { http, HttpResponse } from "msw";

describe("TodoCreateFormContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("「新規タスク追加」ボタンが表示される", async() => {
    renderWithQueryClient(<TodoCreateFormContainer />);
    expect(await screen.findByRole("button", { name: /新規タスク追加/ })).toBeInTheDocument();
  });

  it("ボタンをクリックするとダイアログが開く", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<TodoCreateFormContainer />);

    await user.click(await screen.findByRole("button", { name: /新規タスク追加/ }));
    expect(screen.getByText("新しいタスクを作成")).toBeInTheDocument();
  });

  it("タスク作成成功後にダイアログが閉じる", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<TodoCreateFormContainer />);

    await user.click(await screen.findByRole("button", { name: /新規タスク追加/ }));
    await user.type(screen.getByPlaceholderText("例: レポートを作成する"), "新しいタスク");
    await user.click(await screen.findByRole("button", { name: "タスクを作成" }));

    await waitFor(() => {
      expect(screen.queryByText("新しいタスクを作成")).not.toBeInTheDocument();
    });
  });

  it("タスク作成失敗時はダイアログが開いたまま", async () => {
    server.use(
      http.post("*/api/todos", () =>
        HttpResponse.json({ error: "Server Error" }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderWithQueryClient(<TodoCreateFormContainer />);

    await user.click(await screen.findByRole("button", { name: /新規タスク追加/ }));
    await user.type(screen.getByPlaceholderText("例: レポートを作成する"), "新しいタスク");
    await user.click(await screen.findByRole("button", { name: "タスクを作成" }));
    
    await waitFor(() => {
      expect(screen.getByText("新しいタスクを作成")).toBeInTheDocument();
    });
  });

  it("別のモーダルが開いている時はボタンが無効になる", async () => {
    const { useUIStore } = await import("@/hooks/useExclusiveModal");
    // 別のモーダルが開いている状態を作る
    useUIStore.setState({ currentModalId: "other-modal-id" });

    renderWithQueryClient(<TodoCreateFormContainer />);
    expect(await screen.findByRole("button", { name: /新規タスク追加/ })).toBeDisabled();

    // クリーンアップ
    useUIStore.setState({ currentModalId: null });
  });
});