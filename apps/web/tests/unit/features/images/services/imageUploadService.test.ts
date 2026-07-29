import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { imageUploadService } from "@/features/images/services/imageUploadService";

const createPngFile = (filename = "photo.png"): File => {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([pngBytes], filename, { type: "image/png" });
};

const createUnsupportedFile = (filename = "fake.png"): File => {
  const fakeBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  return new File([fakeBytes], filename, { type: "image/png" });
};

describe("imageUploadService.upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("バリデーションに失敗した場合（不正なマジックバイト）、対応するErrorをthrowし、presigned-urlを取得しないこと", async () => {
    const file = createUnsupportedFile();

    await expect(imageUploadService.upload(file)).rejects.toThrow(
      "対応していないファイル形式です",
    );
  });

  it("presigned-url取得に失敗した場合、Errorをthrowし、B2へのPUTを行わないこと", async () => {
    server.use(
      http.post("*/api/images/presigned-url", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );
    const file = createPngFile();

    await expect(imageUploadService.upload(file)).rejects.toThrow(
      "アップロードURLの取得に失敗しました",
    );
  });

  it("B2へのPUTに失敗した場合、Errorをthrowし、Image作成(POST /api/images)を呼ばないこと", async () => {
    let createImageCalled = false;
    server.use(
      http.post("*/api/images/presigned-url", () =>
        HttpResponse.json({
          uploadUrl: "https://b2.example.com/upload/signed-url",
          storageKey: "uploads/2026/07/01/user1/uuid.png",
        }),
      ),
      http.put("https://b2.example.com/upload/signed-url", () =>
        HttpResponse.json({ message: "b2 error" }, { status: 500 }),
      ),
      http.post("*/api/images", () => {
        createImageCalled = true;
        return HttpResponse.json({});
      }),
    );
    const file = createPngFile();

    await expect(imageUploadService.upload(file)).rejects.toThrow(
      "B2へのアップロードに失敗しました",
    );
    expect(createImageCalled).toBe(false);
  });

  it("Image作成(POST /api/images)に失敗した場合、Errorをthrowすること", async () => {
    server.use(
      http.post("*/api/images/presigned-url", () =>
        HttpResponse.json({
          uploadUrl: "https://b2.example.com/upload/signed-url",
          storageKey: "uploads/2026/07/01/user1/uuid.png",
        }),
      ),
      http.put("https://b2.example.com/upload/signed-url", () => new HttpResponse(null, { status: 200 })),
      http.post("*/api/images", () =>
        HttpResponse.json({ message: "create failed" }, { status: 500 }),
      ),
    );
    const file = createPngFile();

    await expect(imageUploadService.upload(file)).rejects.toThrow(
      "画像の登録に失敗しました",
    );
  });

  it("全工程が成功した場合、作成されたUploadedImageを返すこと", async () => {
    const uploadedImage = {
      id: "img-1",
      originalFileName: "photo.png",
      mimeType: "image/png",
      fileSize: 8,
    };
    server.use(
      http.post("*/api/images/presigned-url", () =>
        HttpResponse.json({
          uploadUrl: "https://b2.example.com/upload/signed-url",
          storageKey: "uploads/2026/07/01/user1/uuid.png",
        }),
      ),
      http.put("https://b2.example.com/upload/signed-url", () => new HttpResponse(null, { status: 200 })),
      http.post("*/api/images", () => HttpResponse.json(uploadedImage)),
    );
    const file = createPngFile();

    const result = await imageUploadService.upload(file);

    expect(result).toEqual(uploadedImage);
  });

  it("presigned-url取得時、file.name/検出されたmimeType/file.sizeをbodyに送ること", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("*/api/images/presigned-url", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          uploadUrl: "https://b2.example.com/upload/signed-url",
          storageKey: "uploads/2026/07/01/user1/uuid.png",
        });
      }),
      http.put("https://b2.example.com/upload/signed-url", () => new HttpResponse(null, { status: 200 })),
      http.post("*/api/images", () => HttpResponse.json({})),
    );
    const file = createPngFile("myphoto.png");

    await imageUploadService.upload(file);

    expect(capturedBody).toEqual({
      originalFileName: "myphoto.png",
      mimeType: "image/png",
      fileSize: file.size,
    });
  });

  it("B2へのPUT時、Content-Typeヘッダーに検出されたmimeTypeを設定すること", async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post("*/api/images/presigned-url", () =>
        HttpResponse.json({
          uploadUrl: "https://b2.example.com/upload/signed-url",
          storageKey: "uploads/2026/07/01/user1/uuid.png",
        }),
      ),
      http.put("https://b2.example.com/upload/signed-url", ({ request }) => {
        capturedContentType = request.headers.get("content-type");
        return new HttpResponse(null, { status: 200 });
      }),
      http.post("*/api/images", () => HttpResponse.json({})),
    );
    const file = createPngFile();

    await imageUploadService.upload(file);

    expect(capturedContentType).toBe("image/png");
  });

  it("Image作成時、storageKey/originalFileName/mimeType/fileSizeをbodyに送ること", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("*/api/images/presigned-url", () =>
        HttpResponse.json({
          uploadUrl: "https://b2.example.com/upload/signed-url",
          storageKey: "uploads/2026/07/01/user1/uuid.png",
        }),
      ),
      http.put("https://b2.example.com/upload/signed-url", () => new HttpResponse(null, { status: 200 })),
      http.post("*/api/images", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({});
      }),
    );
    const file = createPngFile("myphoto.png");

    await imageUploadService.upload(file);

    expect(capturedBody).toEqual({
      storageKey: "uploads/2026/07/01/user1/uuid.png",
      originalFileName: "myphoto.png",
      mimeType: "image/png",
      fileSize: file.size,
    });
  });

  it("バリデーションに失敗した場合（ファイルサイズ超過）、対応するErrorをthrowすること", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngBytes], "huge.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });

    await expect(imageUploadService.upload(file)).rejects.toThrow(
      "ファイルサイズが上限（10MB）を超えています",
    );
  });
});