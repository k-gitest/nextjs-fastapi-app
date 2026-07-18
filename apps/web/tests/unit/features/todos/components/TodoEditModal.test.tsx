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

  it("open=trueの時にモーダルが表示される", async () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);
    // AlbumSelectorがuseAlbums()（Suspense）を経由するため、
    // フォーム本体（TodoEditModalBody）の描画は非同期になる。
    expect(await screen.findByText("タスクを編集")).toBeInTheDocument();
  });

  it("open=falseの時はモーダルが表示されない", () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} open={false} />);
    expect(screen.queryByText("タスクを編集")).not.toBeInTheDocument();
  });

  it("デフォルト値がフォームに反映される", async () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);
    expect(await screen.findByDisplayValue("既存のタスク")).toBeInTheDocument();
  });

  it("isSubmitting=trueの時は送信ボタンが「保存中...」になる", async () => {
    renderWithQueryClient(
      <TodoEditModal {...defaultProps} isSubmitting={true} />
    );
    expect(
      await screen.findByRole("button", { name: "保存中..." })
    ).toBeInTheDocument();
  });

  it("isSubmitting=falseの時は送信ボタンが「変更を保存」になる", async () => {
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);
    expect(
      await screen.findByRole("button", { name: "変更を保存" })
    ).toBeInTheDocument();
  });

  it("フォーム送信でonSubmitが呼ばれる", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(<TodoEditModal {...defaultProps} />);

    const titleInput = await screen.findByDisplayValue("既存のタスク");
    await user.clear(titleInput);
    await user.type(titleInput, "更新されたタスク");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    // Phase2: 第2引数は単数のImageInput(undefined)ではなく、
    // useImageList().toImageListInput() が返すスナップショット配列になる。
    // existingImagesを渡していない（=空配列）ため、画像を追加しなければ
    // 空のImageListInput（[]）が送信される。
    // 第3引数はalbumId。existingAlbumId未指定・Album一覧が空（MSWデフォルトモック）のためnullになる。
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ todo_title: "更新されたタスク" }),
        [],
        null,
      );
    });
  });
});