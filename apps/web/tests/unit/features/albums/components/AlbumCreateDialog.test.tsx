import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AlbumCreateDialog } from "@/features/albums/components/AlbumCreateDialog";

describe("AlbumCreateDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("openがfalseのとき、トリガーボタンは表示されるがダイアログ本体は表示されないこと", () => {
    render(
      <AlbumCreateDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(
      screen.getByRole("button", { name: /新規アルバム/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("新しいアルバムを作成")).not.toBeInTheDocument();
  });

  it("openがtrueのとき、ダイアログが開き見出し・入力欄・作成ボタンが表示されること", () => {
    render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("新しいアルバムを作成")).toBeInTheDocument();
    expect(screen.getByLabelText("アルバム名")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
  });

  it("トリガーボタンをクリックするとonOpenChangeが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumCreateDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /新規アルバム/ }));

    expect(mockOnOpenChange).toHaveBeenCalledWith(true);
  });

  it("未入力で送信すると「アルバム名を入力してください」が表示され、onSubmitは呼ばれないこと", async () => {
    const user = userEvent.setup();
    render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(
      await screen.findByText("アルバム名を入力してください"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("51文字以上入力すると「アルバム名は50文字以内で入力してください」が表示されること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText("アルバム名"), "あ".repeat(51));
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(
      await screen.findByText("アルバム名は50文字以内で入力してください"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("前後の空白はtrimされてonSubmitに渡されること", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText("アルバム名"), "  旅行  ");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({ name: "旅行" });
    });
  });

  it("送信成功後にonOpenChange(false)が呼ばれること", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText("アルバム名"), "旅行");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("送信が失敗（reject）した場合、onOpenChangeは呼ばれないこと", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error("duplicate name"));
    render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText("アルバム名"), "旅行");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("isLoadingがtrueのとき、入力欄と作成ボタンがdisabledになること", () => {
    render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    );

    expect(screen.getByLabelText("アルバム名")).toBeDisabled();
    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();
  });

  it("閉じて再度開くと、入力していた値がリセットされること（keyによる再マウント）", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.type(screen.getByLabelText("アルバム名"), "入力途中のアルバム名");
    expect(screen.getByLabelText("アルバム名")).toHaveValue("入力途中のアルバム名");

    // 閉じる
    rerender(
      <AlbumCreateDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    // 再度開く（key="dialog-open" で再マウントされ、useFormのdefaultValuesに戻る）
    rerender(
      <AlbumCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByLabelText("アルバム名")).toHaveValue("");
  });
});