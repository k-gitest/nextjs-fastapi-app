import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { LibraryImageGrid } from "@/features/images/components/LibraryImageGrid";
import type { ImageSummary } from "@/features/images/types";

describe("LibraryImageGrid", () => {
  const mockOnToggle = vi.fn();

  const mockImages: ImageSummary[] = [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
    },
    {
      id: "img-2",
      originalFileName: "photo2.png",
      mimeType: "image/png",
      fileSize: 2000,
      createdAt: new Date("2026-06-02"),
      usageCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imagesが空のとき、空状態メッセージが表示されること", () => {
    render(
      <LibraryImageGrid
        images={[]}
        selectedImageIds={new Set()}
        attachedImageIds={new Set()}
        onToggle={mockOnToggle}
      />,
    );

    expect(screen.getByText("画像がありません")).toBeInTheDocument();
  });

  it("画像一覧がcheckbox roleで表示されること", () => {
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set()}
        attachedImageIds={new Set()}
        onToggle={mockOnToggle}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "photo1.pngを選択" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "photo2.pngを選択" }),
    ).toBeInTheDocument();
  });

  it("選択済みの画像は aria-checked=true になること", () => {
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set(["img-1"])}
        attachedImageIds={new Set()}
        onToggle={mockOnToggle}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "photo1.pngを選択" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("checkbox", { name: "photo2.pngを選択" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("クリックすると、そのimageIdでonToggleが呼ばれること", async () => {
    const user = userEvent.setup();
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set()}
        attachedImageIds={new Set()}
        onToggle={mockOnToggle}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "photo1.pngを選択" }));

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith("img-1");
  });

  it("Enterキーで選択できること（キーボード操作対応）", async () => {
    const user = userEvent.setup();
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set()}
        attachedImageIds={new Set()}
        onToggle={mockOnToggle}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "photo1.pngを選択" });
    checkbox.focus();
    await user.keyboard("{Enter}");

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith("img-1");
  });

  it("スペースキーで選択できること（キーボード操作対応）", async () => {
    const user = userEvent.setup();
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set()}
        attachedImageIds={new Set()}
        onToggle={mockOnToggle}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "photo1.pngを選択" });
    checkbox.focus();
    await user.keyboard(" ");

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith("img-1");
  });

  it("attachedImageIdsに含まれる画像は「追加済み」ラベルになり、aria-disabled=trueになること", () => {
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set()}
        attachedImageIds={new Set(["img-1"])}
        onToggle={mockOnToggle}
      />,
    );

    const attachedCheckbox = screen.getByRole("checkbox", {
      name: "photo1.pngは追加済みです",
    });
    expect(attachedCheckbox).toHaveAttribute("aria-disabled", "true");
    expect(attachedCheckbox).toHaveAttribute("tabIndex", "-1");
  });

  it("追加済みの画像をクリックしても、onToggleが呼ばれないこと", async () => {
    const user = userEvent.setup();
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set()}
        attachedImageIds={new Set(["img-1"])}
        onToggle={mockOnToggle}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "photo1.pngは追加済みです" }),
    );

    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it("追加済みかつ選択状態であっても、チェックマーク（Checkアイコン）は表示されないこと", () => {
    // attached=trueの場合、selected&&!attachedの条件によりCheckアイコンが出ないUI仕様を検証する。
    // 実装上「追加済み」と「選択中」が同時にtrueになるケースは通常発生しないが、
    // 万一selectedImageIdsに追加済みIDが混入していてもUI上は追加済み表示を優先することを保証する。
    render(
      <LibraryImageGrid
        images={mockImages}
        selectedImageIds={new Set(["img-1"])}
        attachedImageIds={new Set(["img-1"])}
        onToggle={mockOnToggle}
      />,
    );

    const attachedCheckbox = screen.getByRole("checkbox", {
      name: "photo1.pngは追加済みです",
    });
    expect(attachedCheckbox.querySelector("svg")).not.toBeInTheDocument();
  });
});