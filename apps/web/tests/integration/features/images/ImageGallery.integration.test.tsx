import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { ImageGallery } from "@/features/images/components/ImageGallery";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";
import { server } from "@tests/mocks/server";
import { MAX_IMAGES_PER_TODO } from "@/features/images/schemas";
import type {
  ImageItem,
  ImageSummary,
  AddFilesResult,
} from "@/features/images/types";

describe("ImageGallery", () => {
  const mockAddFiles = vi.fn<(files: File[]) => AddFilesResult>();
  const mockAddExistingImages = vi.fn<(images: ImageSummary[]) => AddFilesResult>();
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
    mockAddFiles.mockReturnValue({ ok: true });
    mockAddExistingImages.mockReturnValue({ ok: true });
  });

  it("itemsが空のとき、画像スロットが表示されないこと", () => {
    renderWithQueryClient(
      <ImageGallery
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    expect(screen.queryByRole("button", { name: "画像を削除" })).not.toBeInTheDocument();
  });

  it("itemsがあると、各item分だけImageUploadSlotが表示されること", () => {
    const items = [
      makeItem({ clientId: "client-1", imageId: "img-1" }),
      makeItem({ clientId: "client-2", imageId: "img-2" }),
    ];

    renderWithQueryClient(
      <ImageGallery
        items={items}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    expect(screen.getAllByRole("button", { name: "画像を削除" })).toHaveLength(2);
  });

  it("ファイルを選択すると、addFilesへFile[]が渡されること", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageGallery
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(mockAddFiles).toHaveBeenCalledTimes(1);
    expect(mockAddFiles).toHaveBeenCalledWith([file]);
  });

  it("addFilesがok:trueを返すとエラーが表示されないこと", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageGallery
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      screen.queryByText(/添付できる画像は最大\d+枚です/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("画像の合計サイズが上限を超えています"),
    ).not.toBeInTheDocument();
  });

  it("addFilesがtoo_manyを返すと、枚数上限のエラーメッセージが表示されること", async () => {
    mockAddFiles.mockReturnValue({ ok: false, reason: "too_many" });
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageGallery
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      await screen.findByText(
        `添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`,
      ),
    ).toBeInTheDocument();
  });

  it("addFilesがtoo_largeを返すと、合計サイズ超過のエラーメッセージが表示されること", async () => {
    mockAddFiles.mockReturnValue({ ok: false, reason: "too_large" });
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageGallery
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      await screen.findByText("画像の合計サイズが上限を超えています"),
    ).toBeInTheDocument();
  });

  it("ファイル選択後、input自体の値がリセットされること", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageGallery
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(input.value).toBe("");
  });

  it("item削除で、そのclientIdでremoveItemが呼ばれ、エラーもクリアされること", async () => {
    mockAddFiles.mockReturnValue({ ok: false, reason: "too_many" });
    const items = [makeItem({ clientId: "client-1", imageId: "img-1" })];
    const user = userEvent.setup();

    renderWithQueryClient(
      <ImageGallery
        items={items}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    // 上限エラーを一旦表示させてから削除操作でクリアされることを確認する
    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(
      await screen.findByText(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "画像を削除" }));

    expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockRemoveItem).toHaveBeenCalledWith("client-1");
    expect(
      screen.queryByText(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`),
    ).not.toBeInTheDocument();
  });

  it("attachedImageIdsが正しく算出され、imageId確定済みの画像のみLibraryImagePicker上で「追加済み」表示になること", async () => {
    const libraryImages: ImageSummary[] = [
      {
        id: "img-1",
        originalFileName: "attached.png",
        mimeType: "image/png",
        fileSize: 1000,
        createdAt: new Date("2026-06-01"),
        usageCount: 0,
      },
      {
        id: "img-3",
        originalFileName: "notattached.png",
        mimeType: "image/png",
        fileSize: 1200,
        createdAt: new Date("2026-06-02"),
        usageCount: 0,
      },
    ];
    server.use(
      http.get("*/api/images/unassigned", () => HttpResponse.json(libraryImages)),
    );

    // img-1: origin="existing"でimageId確定済み → attachedImageIdsに含まれる
    // client-2: origin="new"でimageId未確定（アップロード中）→ attachedImageIdsに含まれない
    const items = [
      makeItem({ clientId: "client-1", imageId: "img-1", origin: "existing", status: "done" }),
      makeItem({ clientId: "client-2", imageId: undefined, origin: "new", status: "uploading" }),
    ];
    const user = userEvent.setup();

    renderWithQueryClient(
      <ImageGallery
        items={items}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "ライブラリから選択" }),
    );

    // img-1は添付済みとして無効化表示される
    expect(
      await screen.findByRole("checkbox", { name: "attached.pngは追加済みです" }),
    ).toBeInTheDocument();

    // img-3（未確定itemとは無関係の画像）は通常どおり選択可能
    expect(
      screen.getByRole("checkbox", { name: "notattached.pngを選択" }),
    ).toBeInTheDocument();
  });

  it("LibraryImagePicker経由で画像を選択・追加確定すると、addExistingImagesが選択したImageSummary[]で呼ばれること", async () => {
    const libraryImages: ImageSummary[] = [
      {
        id: "img-5",
        originalFileName: "library.png",
        mimeType: "image/png",
        fileSize: 1000,
        createdAt: new Date("2026-06-01"),
        usageCount: 0,
      },
    ];
    server.use(
      http.get("*/api/images/unassigned", () => HttpResponse.json(libraryImages)),
    );

    const items = [makeItem({ clientId: "client-1", imageId: "img-1" })];
    const user = userEvent.setup();

    renderWithQueryClient(
      <ImageGallery
        items={items}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "ライブラリから選択" }),
    );
    await user.click(
      await screen.findByRole("checkbox", { name: "library.pngを選択" }),
    );
    await user.click(await screen.findByRole("button", { name: "追加（1件）" }));

    expect(mockAddExistingImages).toHaveBeenCalledTimes(1);
    expect(mockAddExistingImages).toHaveBeenCalledWith([
      expect.objectContaining({ id: "img-5" }),
    ]);

    await waitFor(() => {
      expect(
        screen.queryByText("ライブラリから画像を選択"),
      ).not.toBeInTheDocument();
    });
  });

  it("disabledがfile inputとLibraryImagePickerトリガーの両方に伝播すること", async () => {
    renderWithQueryClient(
      <ImageGallery
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
        disabled
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(
      await screen.findByRole("button", { name: "ライブラリから選択" }),
    ).toBeDisabled();
  });

  it("上限到達時は追加UI(file input・LibraryImagePicker)が非表示になり、上限メッセージが表示されること", () => {
    const items = Array.from({ length: MAX_IMAGES_PER_TODO }, (_, i) =>
      makeItem({ clientId: `client-${i}`, imageId: `img-${i}` }),
    );

    renderWithQueryClient(
      <ImageGallery
        items={items}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        removeItem={mockRemoveItem}
      />,
    );

    expect(
      screen.getByText(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`),
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ライブラリから選択" }),
    ).not.toBeInTheDocument();
  });
});