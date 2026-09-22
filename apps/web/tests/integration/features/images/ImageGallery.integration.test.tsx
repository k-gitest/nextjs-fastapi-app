import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ImageGallery } from "@/features/images/components/ImageGallery";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";
import type { ImageItem } from "@/features/images/types";

describe("ImageGallery", () => {
  const mockRemoveItem = vi.fn();

  const makeItem = (overrides: Partial<ImageItem> = {}): ImageItem => ({
    clientId: "client-1",
    origin: "new",
    file: null,
    previewUrl: "blob:preview-1",
    fileSize: 1000,
    order: 0,
    status: "done",
    imageId: "img-1",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("itemsが空のとき、何も描画されないこと", () => {
    const { container } = renderWithQueryClient(
      <ImageGallery items={[]} removeItem={mockRemoveItem} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("itemsがあると、各item分だけImageUploadSlotが表示されること", () => {
    const items = [
      makeItem({ clientId: "client-1", imageId: "img-1" }),
      makeItem({ clientId: "client-2", imageId: "img-2" }),
    ];

    renderWithQueryClient(<ImageGallery items={items} removeItem={mockRemoveItem} />);

    expect(screen.getAllByRole("button", { name: "画像を削除" })).toHaveLength(2);
  });

  it("item削除で、そのclientIdでremoveItemが呼ばれること", async () => {
    const items = [makeItem({ clientId: "client-1", imageId: "img-1" })];
    const user = userEvent.setup();

    renderWithQueryClient(<ImageGallery items={items} removeItem={mockRemoveItem} />);

    await user.click(screen.getByRole("button", { name: "画像を削除" }));

    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockRemoveItem).toHaveBeenCalledWith("client-1");
  });
});