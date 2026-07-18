import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoCreateForm } from "@/features/todos/components/TodoCreateForm";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";

const mockOnSubmit = vi.fn();
const mockOnOpenChange = vi.fn();

const defaultProps = {
  open: true,
  onOpenChange: mockOnOpenChange,
  onSubmit: mockOnSubmit,
};

describe("TodoCreateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ダイアログが開いている時にフォームが表示される", async () => {
    renderWithQueryClient(<TodoCreateForm {...defaultProps} />);
    // AlbumSelectorがuseAlbums()（Suspense）を経由するため、
    // フォーム本体（TodoCreateFormBody）の描画は非同期になる。
    expect(await screen.findByText("新しいタスクを作成")).toBeInTheDocument();
    expect(
      await screen.findByPlaceholderText("例: レポートを作成する"),
    ).toBeInTheDocument();
  });

  it("open=falseの時はダイアログが表示されない", () => {
    renderWithQueryClient(<TodoCreateForm {...defaultProps} open={false} />);
    expect(screen.queryByText("新しいタスクを作成")).not.toBeInTheDocument();
  });

  it("「新規タスク追加」ボタンがレンダリングされる", () => {
    renderWithQueryClient(<TodoCreateForm {...defaultProps} open={false} />);
    expect(
      screen.getByRole("button", { name: /新規タスク追加/ }),
    ).toBeInTheDocument();
  });

  it("disabled=trueの時はボタンが無効になる", () => {
    renderWithQueryClient(
      <TodoCreateForm {...defaultProps} open={false} disabled={true} />,
    );
    expect(
      screen.getByRole("button", { name: /新規タスク追加/ }),
    ).toBeDisabled();
  });

  it("isLoading=trueの時は送信ボタンが「作成中...」になる", async () => {
    renderWithQueryClient(
      <TodoCreateForm {...defaultProps} isLoading={true} />,
    );
    expect(
      await screen.findByRole("button", { name: "保存中..." }),
    ).toBeInTheDocument();
  });

  it("フォーム送信後にonOpenChange(false)が呼ばれる", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(<TodoCreateForm {...defaultProps} />);

    await user.type(
      await screen.findByPlaceholderText("例: レポートを作成する"),
      "テストタスク",
    );
    await user.click(screen.getByRole("button", { name: "タスクを作成" }));

    // Phase2: 第2引数は単数のImageInput(undefined)ではなく、
    // useImageList().toCreateImageListInput() が返すスナップショット配列になる。
    // 画像を追加していないため、空のCreateImageListInput（[]）が送信される。
    // 第3引数はalbumId。Album一覧が空（MSWデフォルトモック）のためnullになる。
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ todo_title: "テストタスク" }),
        [],
        null,
      );
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("onSubmitが失敗してもonOpenChange(false)は呼ばれない", async () => {
    mockOnSubmit.mockRejectedValueOnce(new Error("作成失敗"));
    const user = userEvent.setup();
    renderWithQueryClient(<TodoCreateForm {...defaultProps} />);

    await user.type(
      await screen.findByPlaceholderText("例: レポートを作成する"),
      "テストタスク",
    );
    await user.click(screen.getByRole("button", { name: "タスクを作成" }));

    await waitFor(() => {
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});