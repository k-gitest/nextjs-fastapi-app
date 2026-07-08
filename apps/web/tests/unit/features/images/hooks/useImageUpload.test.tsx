// apps/web/tests/unit/features/images/hooks/useImageUpload.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useImageUpload } from "@/features/images/hooks/useImageUpload";
import { validateImageFile } from "@/features/images/lib/validate-image";
import type { ImageValidationResult } from "@/features/images/lib/validate-image";

vi.mock("@/features/images/lib/validate-image", () => ({
  validateImageFile: vi.fn(),
}));

const mockValidateImageFile = vi.mocked(validateImageFile);

const createFile = (name = "test.png", type = "image/png", size = 1024) => {
  return new File(["a".repeat(size)], name, { type });
};

describe("useImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn() as any;
  });

  it("初期状態はidleである", () => {
    const { result } = renderHook(() => useImageUpload());
    expect(result.current.state.status).toBe("idle");
  });

  describe("バリデーション", () => {
    it("サイズ超過の場合はerror状態になり適切なメッセージを返す", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: false,
        reason: "too_large",
      });

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.state).toEqual({
        status: "error",
        message: "ファイルサイズが上限（10MB）を超えています",
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("未対応形式の場合はerror状態になり適切なメッセージを返す", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: false,
        reason: "unsupported_type",
      });

      const { result } = renderHook(() => useImageUpload());
      const file = createFile("test.bmp", "image/bmp");

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.state).toEqual({
        status: "error",
        message: "対応していないファイル形式です",
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("upload呼び出し直後はvalidating状態になる", async () => {
      let resolveValidation!: (value: ImageValidationResult) => void;
      mockValidateImageFile.mockImplementation(
        () =>
          new Promise<ImageValidationResult>((resolve) => {
            resolveValidation = resolve;
          }),
      );

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      act(() => {
        void result.current.upload(file);
      });

      await waitFor(() => {
        expect(result.current.state.status).toBe("validating");
      });

      // 後片付け：ぶら下がったpromiseを解決する
      act(() => {
        resolveValidation({
          ok: true,
          mimeType: "image/png",
          extension: "png",
        });
      });
    });
  });

  describe("アップロード成功", () => {
    it("presigned URL取得 → PUTアップロードが成功するとdone状態になる", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: true,
        mimeType: "image/png",
        extension: "png",
      });

      global.fetch = vi
        .fn()
        // ① presigned URL取得
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadUrl: "https://b2.example.com/upload",
            storageKey: "images/abc123.png",
          }),
        } as Response)
        // ② B2へのPUTアップロード
        .mockResolvedValueOnce({ ok: true } as Response);

      const { result } = renderHook(() => useImageUpload());
      const file = createFile("photo.png", "image/png", 2048);

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.state).toEqual({
        status: "done",
        result: {
          storageKey: "images/abc123.png",
          originalFileName: "photo.png",
          mimeType: "image/png",
          fileSize: file.size,
        },
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);

      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "/api/images/presigned-url",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalFileName: "photo.png",
            mimeType: "image/png",
            fileSize: file.size,
          }),
        }),
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "https://b2.example.com/upload",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: file,
        }),
      );
    });

    it("アップロード中はuploading状態になる", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: true,
        mimeType: "image/png",
        extension: "png",
      });

      let resolvePresigned!: (value: {
        ok: boolean;
        json: () => Promise<{ uploadUrl: string; storageKey: string }>;
      }) => void;

      global.fetch = vi.fn().mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePresigned = resolve;
          }),
      );

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      act(() => {
        void result.current.upload(file);
      });

      await waitFor(() => {
        expect(result.current.state).toEqual({
          status: "uploading",
          progress: 0,
        });
      });

      // 後片付け：ぶら下がったpromiseを解決する
      act(() => {
        resolvePresigned({
          ok: true,
          json: async () => ({ uploadUrl: "u", storageKey: "k" }),
        });
      });
    });
  });

  describe("アップロード失敗", () => {
    it("presigned URL取得が失敗した場合はerror状態になる", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: true,
        mimeType: "image/png",
        extension: "png",
      });

      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.state).toEqual({
        status: "error",
        message: "アップロードURLの取得に失敗しました",
      });
    });

    it("presigned URL取得中にネットワークエラーが発生した場合はerror状態になる", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: true,
        mimeType: "image/png",
        extension: "png",
      });

      global.fetch = vi.fn().mockRejectedValueOnce(new Error("network down"));

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.state).toEqual({
        status: "error",
        message: "network down",
      });
    });

    it("B2へのPUTアップロードが失敗した場合はerror状態になる", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: true,
        mimeType: "image/png",
        extension: "png",
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadUrl: "https://b2.example.com/upload",
            storageKey: "images/abc123.png",
          }),
        } as Response)
        .mockResolvedValueOnce({ ok: false } as Response);

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.state).toEqual({
        status: "error",
        message: "B2へのアップロードに失敗しました",
      });
    });

    it("Errorインスタンスでない例外の場合は汎用エラーメッセージになる", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: true,
        mimeType: "image/png",
        extension: "png",
      });

      global.fetch = vi.fn().mockRejectedValueOnce("string error");

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.state).toEqual({
        status: "error",
        message: "アップロード中にエラーが発生しました",
      });
    });
  });

  describe("reset", () => {
    it("error状態からreset()でidleに戻る", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: false,
        reason: "too_large",
      });

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      await act(async () => {
        await result.current.upload(file);
      });
      expect(result.current.state.status).toBe("error");

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toEqual({ status: "idle" });
    });

    it("done状態からreset()でidleに戻る", async () => {
      mockValidateImageFile.mockResolvedValue({
        ok: true,
        mimeType: "image/png",
        extension: "png",
      });
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ uploadUrl: "u", storageKey: "k" }),
        } as Response)
        .mockResolvedValueOnce({ ok: true } as Response);

      const { result } = renderHook(() => useImageUpload());
      const file = createFile();

      await act(async () => {
        await result.current.upload(file);
      });
      expect(result.current.state.status).toBe("done");

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toEqual({ status: "idle" });
    });
  });
});