import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ImageUploadSlot } from "@/features/images/components/ImageUploadSlot";
import type { ImageItem } from "@/features/images/types";

describe("ImageUploadSlot", () => {
  const mockRemoveItem = vi.fn();

  const baseItem: ImageItem = {
    clientId: "client-1",
    origin: "new",
    file: null,
    previewUrl: "blob:preview-1",
    fileSize: 1000,
    order: 0,
    status: "uploading",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previewUrlが画像のsrcとして表示されること", () => {
    render(<ImageUploadSlot item={baseItem} removeItem={mockRemoveItem} />);

    const img = screen.getByAltText("添付画像");
    expect(img).toHaveAttribute("src", "blob:preview-1");
  });

  it("status=uploadingのとき、「アップロード中…」が表示されること", () => {
    render(
      <ImageUploadSlot
        item={{ ...baseItem, status: "uploading" }}
        removeItem={mockRemoveItem}
      />,
    );

    expect(screen.getByText("アップロード中…")).toBeInTheDocument();
  });

  it("status=doneのとき、進行中・エラー表示のいずれも出ないこと", () => {
    render(
      <ImageUploadSlot
        item={{ ...baseItem, status: "done", imageId: "img-1" }}
        removeItem={mockRemoveItem}
      />,
    );

    expect(screen.queryByText("アップロード中…")).not.toBeInTheDocument();
    expect(
      screen.queryByText("アップロードに失敗しました"),
    ).not.toBeInTheDocument();
  });

  it("status=errorのとき、item.errorのメッセージが表示されること", () => {
    render(
      <ImageUploadSlot
        item={{ ...baseItem, status: "error", error: "ファイルが大きすぎます" }}
        removeItem={mockRemoveItem}
      />,
    );

    expect(screen.getByText("ファイルが大きすぎます")).toBeInTheDocument();
  });

  it("status=errorかつitem.errorが未設定のとき、デフォルトのエラーメッセージが表示されること", () => {
    render(
      <ImageUploadSlot
        item={{ ...baseItem, status: "error", error: undefined }}
        removeItem={mockRemoveItem}
      />,
    );

    expect(
      screen.getByText("アップロードに失敗しました"),
    ).toBeInTheDocument();
  });

  it("削除ボタンをクリックすると、item.clientIdでremoveItemが呼ばれること", async () => {
    const user = userEvent.setup();
    render(<ImageUploadSlot item={baseItem} removeItem={mockRemoveItem} />);

    await user.click(screen.getByRole("button", { name: "画像を削除" }));

    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockRemoveItem).toHaveBeenCalledWith("client-1");
  });

  it("imageId（DB上のImage.id）ではなく、常にclientIdが削除の照合キーとして使われること", async () => {
    const user = userEvent.setup();
    render(
      <ImageUploadSlot
        item={{ ...baseItem, status: "done", imageId: "db-image-id-999" }}
        removeItem={mockRemoveItem}
      />,
    );

    await user.click(screen.getByRole("button", { name: "画像を削除" }));

    expect(mockRemoveItem).toHaveBeenCalledWith("client-1");
    expect(mockRemoveItem).not.toHaveBeenCalledWith("db-image-id-999");
  });
});