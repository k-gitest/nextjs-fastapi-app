import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AlbumEditDialog } from "@/features/albums/components/AlbumEditDialog";
import type { Album } from "@/features/albums/types";

describe("AlbumEditDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSubmit = vi.fn();

  const mockAlbum: Album = {
    id: "album-1",
    name: "夏休み",
    userId: "user-1",
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
  } as Album;

  const mockOtherAlbum: Album = {
    id: "album-2",
    name: "旅行",
    userId: "user-1",
    createdAt: new Date("2026-05-02"),
    updatedAt: new Date("2026-05-02"),
  } as Album;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("albumがnullのとき、ダイアログ本体が表示されないこと", () => {
    render(
      <AlbumEditDialog
        album={null}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.queryByText("アルバム名を変更")).not.toBeInTheDocument();
  });

  it("albumが渡されると、ダイアログが開きalbum.nameが入力欄の初期値として反映されること", () => {
    render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("アルバム名を変更")).toBeInTheDocument();
    expect(screen.getByLabelText("アルバム名")).toHaveValue("夏休み");
  });

  it("入力を空にして送信すると「アルバム名を入力してください」が表示され、onSubmitは呼ばれないこと", async () => {
    const user = userEvent.setup();
    render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("アルバム名"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("アルバム名を入力してください"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("51文字以上入力すると「アルバム名は50文字以内で入力してください」が表示されること", async () => {
    const user = userEvent.setup();
    render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("アルバム名"));
    await user.type(screen.getByLabelText("アルバム名"), "あ".repeat(51));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("アルバム名は50文字以内で入力してください"),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("前後の空白はtrimされてonSubmitに渡されること", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("アルバム名"));
    await user.type(screen.getByLabelText("アルバム名"), "  冬休み  ");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({ name: "冬休み" });
    });
  });

  it("送信成功後にonOpenChange(false)が呼ばれること", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("アルバム名"));
    await user.type(screen.getByLabelText("アルバム名"), "冬休み");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("送信が失敗（reject）した場合、onOpenChangeは呼ばれないこと", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error("duplicate name"));
    render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("アルバム名"));
    await user.type(screen.getByLabelText("アルバム名"), "冬休み");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("isLoadingがtrueのとき、入力欄と保存ボタンがdisabledになること", () => {
    render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    );

    expect(screen.getByLabelText("アルバム名")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("別のAlbumに切り替わると、入力途中の値を破棄して新しいalbum.nameで再初期化されること（keyがalbum.idのため再マウントされる）", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    await user.clear(screen.getByLabelText("アルバム名"));
    await user.type(screen.getByLabelText("アルバム名"), "編集途中の名前");
    expect(screen.getByLabelText("アルバム名")).toHaveValue("編集途中の名前");

    rerender(
      <AlbumEditDialog
        album={mockOtherAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByLabelText("アルバム名")).toHaveValue("旅行");
  });

  it("albumがnullに戻ると、ダイアログ本体が再び表示されなくなること", () => {
    const { rerender } = render(
      <AlbumEditDialog
        album={mockAlbum}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("アルバム名を変更")).toBeInTheDocument();

    rerender(
      <AlbumEditDialog
        album={null}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.queryByText("アルバム名を変更")).not.toBeInTheDocument();
  });
});