import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { ImageAttachMenu } from "@/features/images/components/ImageAttachMenu";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";
import { server } from "@tests/mocks/server";
import { MAX_IMAGES_PER_TODO } from "@/features/images/schemas";
import type {
  ImageItem,
  ImageSummary,
  AddFilesResult,
} from "@/features/images/types";

describe("ImageAttachMenu", () => {
  const mockAddFiles = vi.fn<(files: File[]) => AddFilesResult>();
  const mockAddExistingImages = vi.fn<(images: ImageSummary[]) => AddFilesResult>();

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

  it("トリガーアイコンが表示されること", () => {
    renderWithQueryClient(
      <ImageAttachMenu
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
      />,
    );

    expect(screen.getByRole("button", { name: "画像を添付" })).toBeInTheDocument();
  });

  it("disabledのとき、トリガーアイコンがdisabledになること", () => {
    renderWithQueryClient(
      <ImageAttachMenu
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: "画像を添付" })).toBeDisabled();
  });

  it("上限到達時は、トリガーアイコンがdisabledになり、上限メッセージが表示されること", () => {
    const items = Array.from({ length: MAX_IMAGES_PER_TODO }, (_, i) =>
      makeItem({ clientId: `client-${i}`, imageId: `img-${i}` }),
    );

    renderWithQueryClient(
      <ImageAttachMenu
        items={items}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
      />,
    );

    expect(screen.getByRole("button", { name: "画像を添付" })).toBeDisabled();
    expect(
      screen.getByText(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`),
    ).toBeInTheDocument();
  });

  it("トリガーを開くと、「ファイルを追加」「ライブラリから追加」の2項目が表示されること", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageAttachMenu
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
      />,
    );

    await user.click(screen.getByRole("button", { name: "画像を添付" }));

    expect(
      await screen.findByRole("menuitem", { name: "ファイルを追加" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "ライブラリから追加" }),
    ).toBeInTheDocument();
  });

  describe("「ファイルを追加」選択時", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("非表示のfile inputのclickが呼ばれること", async () => {
      const clickSpy = vi
        .spyOn(HTMLInputElement.prototype, "click")
        .mockImplementation(() => {});
      const user = userEvent.setup();

      renderWithQueryClient(
        <ImageAttachMenu
          items={[]}
          addFiles={mockAddFiles}
          addExistingImages={mockAddExistingImages}
        />,
      );

      await user.click(screen.getByRole("button", { name: "画像を添付" }));
      await user.click(
        await screen.findByRole("menuitem", { name: "ファイルを追加" }),
      );

      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    });
  });

  it("file inputへファイルを設定すると、addFilesへFile[]が渡され、選択後にinputの値がリセットされること", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageAttachMenu
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(mockAddFiles).toHaveBeenCalledTimes(1);
    expect(mockAddFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe("");
  });

  it("addFilesがtoo_manyを返すと、枚数上限のエラーメッセージが表示されること", async () => {
    mockAddFiles.mockReturnValue({ ok: false, reason: "too_many" });
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageAttachMenu
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      await screen.findByText(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`),
    ).toBeInTheDocument();
  });

  it("addFilesがtoo_largeを返すと、合計サイズ超過のエラーメッセージが表示されること", async () => {
    mockAddFiles.mockReturnValue({ ok: false, reason: "too_large" });
    const user = userEvent.setup();
    renderWithQueryClient(
      <ImageAttachMenu
        items={[]}
        addFiles={mockAddFiles}
        addExistingImages={mockAddExistingImages}
      />,
    );

    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      await screen.findByText("画像の合計サイズが上限を超えています"),
    ).toBeInTheDocument();
  });

  describe("「ライブラリから追加」選択時", () => {
    it("LibraryImagePickerのダイアログが開くこと", async () => {
      server.use(
        http.get("*/api/images/unassigned", () => HttpResponse.json([])),
      );
      const user = userEvent.setup();

      renderWithQueryClient(
        <ImageAttachMenu
          items={[]}
          addFiles={mockAddFiles}
          addExistingImages={mockAddExistingImages}
        />,
      );

      await user.click(screen.getByRole("button", { name: "画像を添付" }));
      await user.click(
        await screen.findByRole("menuitem", { name: "ライブラリから追加" }),
      );

      expect(
        await screen.findByText("ライブラリから画像を選択"),
      ).toBeInTheDocument();
    });

    it("画像を選択・追加確定すると、addExistingImagesが呼ばれ、ダイアログが閉じること", async () => {
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
      const user = userEvent.setup();

      renderWithQueryClient(
        <ImageAttachMenu
          items={[]}
          addFiles={mockAddFiles}
          addExistingImages={mockAddExistingImages}
        />,
      );

      await user.click(screen.getByRole("button", { name: "画像を添付" }));
      await user.click(
        await screen.findByRole("menuitem", { name: "ライブラリから追加" }),
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

    it("attachedImageIdsが正しく算出され、imageId確定済みの画像のみ「追加済み」表示になること", async () => {
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
        <ImageAttachMenu
          items={items}
          addFiles={mockAddFiles}
          addExistingImages={mockAddExistingImages}
        />,
      );

      await user.click(screen.getByRole("button", { name: "画像を添付" }));
      await user.click(
        await screen.findByRole("menuitem", { name: "ライブラリから追加" }),
      );

      expect(
        await screen.findByRole("checkbox", { name: "attached.pngは追加済みです" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "notattached.pngを選択" }),
      ).toBeInTheDocument();
    });
  });
});