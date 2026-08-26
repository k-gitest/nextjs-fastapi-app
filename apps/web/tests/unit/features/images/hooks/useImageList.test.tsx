import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useImageList } from "@/features/images/hooks/useImageList";
import { imageUploadService } from "@/features/images/services/imageUploadService";
import type { ImageSummary } from "@/features/images/types";

vi.mock("@/features/images/services/imageUploadService", () => ({
  imageUploadService: { upload: vi.fn() },
}));

// File.sizeは読み取り専用だが、Object.definePropertyで上書きすれば
// 実際に巨大なバッファを確保せずに任意のサイズを持つFileを模擬できる
const makeFile = (name: string, size: number, type = "image/jpeg"): File => {
  const file = new File([""], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const makeExistingImageSummary = (
  id: string,
  fileSize = 1024,
): ImageSummary => ({
  id,
  originalFileName: `${id}.jpg`,
  mimeType: "image/jpeg",
  fileSize,
  createdAt: new Date(),
  usageCount: 0,
});

describe("useImageList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();

    // 個別テストで明示的にモックしない限り、undefined.then()でのTypeErrorを防ぐための既定値。
    // アップロード結果の中身自体を検証しないテスト（reindex確認・境界値確認等）で必要。
    vi.mocked(imageUploadService.upload).mockResolvedValue({
      id: "default-uploaded-id",
      originalFileName: "default.jpg",
      mimeType: "image/jpeg",
      fileSize: 100,
    });
  });

  // ── addFiles ────────────────────────────────────────────────────────────────

  describe("addFiles", () => {
    it("空配列を渡した場合は即座に{ ok: true }を返し、itemsは変化しないこと", () => {
      const { result } = renderHook(() => useImageList());

      let addResult;
      act(() => {
        addResult = result.current.addFiles([]);
      });

      expect(addResult).toEqual({ ok: true });
      expect(result.current.items).toHaveLength(0);
    });

    it("正常系: itemが status=uploading で生成され、アップロード成功後 status=done になること", async () => {
      vi.mocked(imageUploadService.upload).mockResolvedValueOnce({
        id: "img-new-1",
        originalFileName: "a.jpg",
        mimeType: "image/jpeg",
        fileSize: 1000,
      });

      const { result } = renderHook(() => useImageList());
      const file = makeFile("a.jpg", 1000);

      act(() => {
        result.current.addFiles([file]);
      });

      // アップロード開始直後はuploading、imageIdは未確定
      expect(result.current.items[0].status).toBe("uploading");
      expect(result.current.items[0].imageId).toBeUndefined();

      await waitFor(() => {
        expect(result.current.items[0].status).toBe("done");
      });

      expect(result.current.items[0].imageId).toBe("img-new-1");
      expect(result.current.items[0].previewUrl).toBe(
        "/api/images/img-new-1/view",
      );
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("アップロード失敗時は status=error になり、errorメッセージが反映されること", async () => {
      vi.mocked(imageUploadService.upload).mockRejectedValueOnce(
        new Error("対応していないファイル形式です"),
      );

      const { result } = renderHook(() => useImageList());
      const file = makeFile("a.gif", 1000);

      act(() => {
        result.current.addFiles([file]);
      });

      await waitFor(() => {
        expect(result.current.items[0].status).toBe("error");
      });

      expect(result.current.items[0].error).toBe(
        "対応していないファイル形式です",
      );
    });

    it("追加後にorderが0からreindexされること", () => {
      const { result } = renderHook(() => useImageList());
      const files = [makeFile("a.jpg", 100), makeFile("b.jpg", 100)];

      act(() => {
        result.current.addFiles(files);
      });

      expect(result.current.items.map((i) => i.order)).toEqual([0, 1]);
    });

    it("枚数上限（20枚）を超える場合はtoo_manyを返し、itemsは追加されないこと", () => {
      const existing = Array.from({ length: 20 }, (_, i) => ({
        id: `existing-${i}`,
        fileSize: 100,
        order: i,
      }));
      const { result } = renderHook(() => useImageList(existing));

      let addResult;
      act(() => {
        addResult = result.current.addFiles([makeFile("new.jpg", 100)]);
      });

      expect(addResult).toEqual({ ok: false, reason: "too_many" });
      expect(result.current.items).toHaveLength(20);
    });

    it("合計サイズ上限（30MB）を超える場合はtoo_largeを返し、itemsは追加されないこと", () => {
      const existing = [
        { id: "existing-1", fileSize: 25 * 1024 * 1024, order: 0 },
      ];
      const { result } = renderHook(() => useImageList(existing));

      let addResult;
      act(() => {
        addResult = result.current.addFiles([
          makeFile("big.jpg", 6 * 1024 * 1024),
        ]);
      });

      expect(addResult).toEqual({ ok: false, reason: "too_large" });
      expect(result.current.items).toHaveLength(1);
    });

    it("枚数・サイズとも上限内であれば追加されること（境界値: ちょうど20枚・ちょうど30MB）", () => {
      const existing = Array.from({ length: 19 }, (_, i) => ({
        id: `existing-${i}`,
        fileSize: 1024,
        order: i,
      }));
      const { result } = renderHook(() => useImageList(existing));

      let addResult;
      act(() => {
        addResult = result.current.addFiles([makeFile("new.jpg", 1024)]);
      });

      expect(addResult).toEqual({ ok: true });
      expect(result.current.items).toHaveLength(20);
    });

    it("合計サイズがちょうど上限（30MB）の場合は追加されること（境界値）", () => {
      const existing = [
        { id: "existing-1", fileSize: 29 * 1024 * 1024, order: 0 },
      ];
      const { result } = renderHook(() => useImageList(existing));

      let addResult;
      act(() => {
        addResult = result.current.addFiles([
          makeFile("exact.jpg", 1 * 1024 * 1024),
        ]);
      });

      expect(addResult).toEqual({ ok: true });
      expect(result.current.items).toHaveLength(2);
    });
  });

  // ── addExistingImages ──────────────────────────────────────────────────────

  describe("addExistingImages", () => {
    it("空配列を渡した場合は即座に{ ok: true }を返すこと", () => {
      const { result } = renderHook(() => useImageList());

      let addResult;
      act(() => {
        addResult = result.current.addExistingImages([]);
      });

      expect(addResult).toEqual({ ok: true });
      expect(result.current.items).toHaveLength(0);
    });

    it("正常系: origin=existing・status=doneで即座に追加されること", () => {
      const { result } = renderHook(() => useImageList());
      const image = makeExistingImageSummary("img-1");

      act(() => {
        result.current.addExistingImages([image]);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]).toMatchObject({
        clientId: "img-1",
        imageId: "img-1",
        origin: "existing",
        status: "done",
        previewUrl: "/api/images/img-1/view",
      });
    });

    it("既にitemsに含まれるimageIdは除外されること（一部重複）", () => {
      const { result } = renderHook(() =>
        useImageList([{ id: "img-1", fileSize: 1024, order: 0 }]),
      );
      const images = [
        makeExistingImageSummary("img-1"),
        makeExistingImageSummary("img-2"),
      ];

      act(() => {
        result.current.addExistingImages(images);
      });

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.map((i) => i.imageId)).toEqual([
        "img-1",
        "img-2",
      ]);
    });

    it("全件重複の場合は追加せず{ ok: true }を返すこと", () => {
      const { result } = renderHook(() =>
        useImageList([{ id: "img-1", fileSize: 1024, order: 0 }]),
      );

      let addResult;
      act(() => {
        addResult = result.current.addExistingImages([
          makeExistingImageSummary("img-1"),
        ]);
      });

      expect(addResult).toEqual({ ok: true });
      expect(result.current.items).toHaveLength(1);
    });

    it("枚数上限を超える場合はtoo_manyを返すこと", () => {
      const existing = Array.from({ length: 20 }, (_, i) => ({
        id: `existing-${i}`,
        fileSize: 100,
        order: i,
      }));
      const { result } = renderHook(() => useImageList(existing));

      let addResult;
      act(() => {
        addResult = result.current.addExistingImages([
          makeExistingImageSummary("new-img"),
        ]);
      });

      expect(addResult).toEqual({ ok: false, reason: "too_many" });
      expect(result.current.items).toHaveLength(20);
    });

    it("合計サイズ上限を超える場合はtoo_largeを返すこと", () => {
      const existing = [
        { id: "existing-1", fileSize: 25 * 1024 * 1024, order: 0 },
      ];
      const { result } = renderHook(() => useImageList(existing));

      let addResult;
      act(() => {
        addResult = result.current.addExistingImages([
          makeExistingImageSummary("new-img", 6 * 1024 * 1024),
        ]);
      });

      expect(addResult).toEqual({ ok: false, reason: "too_large" });
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe("removeItem", () => {
    it("origin=newのitemを削除する際はrevokeObjectURLが呼ばれること", () => {
      vi.mocked(imageUploadService.upload).mockReturnValueOnce(
        new Promise(() => {}),
      ); // pending

      const { result } = renderHook(() => useImageList());
      const file = makeFile("a.jpg", 100);

      act(() => {
        result.current.addFiles([file]);
      });
      const clientId = result.current.items[0].clientId;

      act(() => {
        result.current.removeItem(clientId);
      });

      expect(result.current.items).toHaveLength(0);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("origin=existingのitemを削除する際はrevokeObjectURLが呼ばれないこと", () => {
      const { result } = renderHook(() =>
        useImageList([{ id: "img-1", fileSize: 100, order: 0 }]),
      );

      act(() => {
        result.current.removeItem("img-1");
      });

      expect(result.current.items).toHaveLength(0);
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it("削除後にorderが0からreindexされること", () => {
      const { result } = renderHook(() =>
        useImageList([
          { id: "img-1", fileSize: 100, order: 0 },
          { id: "img-2", fileSize: 100, order: 1 },
          { id: "img-3", fileSize: 100, order: 2 },
        ]),
      );

      act(() => {
        result.current.removeItem("img-2");
      });

      expect(result.current.items.map((i) => i.clientId)).toEqual([
        "img-1",
        "img-3",
      ]);
      expect(result.current.items.map((i) => i.order)).toEqual([0, 1]);
    });
  });

  // ── moveItem ───────────────────────────────────────────────────────────────

  describe("moveItem", () => {
    const initial = [
      { id: "img-1", fileSize: 100, order: 0 },
      { id: "img-2", fileSize: 100, order: 1 },
      { id: "img-3", fileSize: 100, order: 2 },
    ];

    it("正常系: fromIndexの要素をtoIndexへ移動し、orderが振り直されること", () => {
      const { result } = renderHook(() => useImageList(initial));

      act(() => {
        result.current.moveItem(0, 2);
      });

      expect(result.current.items.map((i) => i.clientId)).toEqual([
        "img-2",
        "img-3",
        "img-1",
      ]);
      expect(result.current.items.map((i) => i.order)).toEqual([0, 1, 2]);
    });

    it("fromIndex === toIndexの場合は何も変化しないこと", () => {
      const { result } = renderHook(() => useImageList(initial));

      act(() => {
        result.current.moveItem(1, 1);
      });

      expect(result.current.items.map((i) => i.clientId)).toEqual([
        "img-1",
        "img-2",
        "img-3",
      ]);
    });

    it("負のindexの場合は何も変化しないこと", () => {
      const { result } = renderHook(() => useImageList(initial));

      act(() => {
        result.current.moveItem(-1, 1);
      });

      expect(result.current.items.map((i) => i.clientId)).toEqual([
        "img-1",
        "img-2",
        "img-3",
      ]);
    });

    it("範囲外のindexの場合は何も変化しないこと", () => {
      const { result } = renderHook(() => useImageList(initial));

      act(() => {
        result.current.moveItem(0, 10);
      });

      expect(result.current.items.map((i) => i.clientId)).toEqual([
        "img-1",
        "img-2",
        "img-3",
      ]);
    });
  });

  // ── canSave / isUploading / hasError ─────────────────────────────────────────

  describe("canSave / isUploading / hasError", () => {
    it("items が空の場合、canSaveはtrueであること", () => {
      const { result } = renderHook(() => useImageList());

      expect(result.current.canSave).toBe(true);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it("全itemがdoneの場合、canSaveはtrueであること", () => {
      const { result } = renderHook(() =>
        useImageList([{ id: "img-1", fileSize: 100, order: 0 }]),
      );

      expect(result.current.canSave).toBe(true);
    });

    it("uploading中のitemがある場合、canSave=false・isUploading=trueであること", () => {
      vi.mocked(imageUploadService.upload).mockReturnValueOnce(
        new Promise(() => {}),
      ); // pending

      const { result } = renderHook(() => useImageList());

      act(() => {
        result.current.addFiles([makeFile("a.jpg", 100)]);
      });

      expect(result.current.canSave).toBe(false);
      expect(result.current.isUploading).toBe(true);
      expect(result.current.hasError).toBe(false);
    });

    it("errorのitemがある場合、canSave=false・hasError=trueであること", async () => {
      vi.mocked(imageUploadService.upload).mockRejectedValueOnce(
        new Error("失敗"),
      );

      const { result } = renderHook(() => useImageList());

      act(() => {
        result.current.addFiles([makeFile("a.jpg", 100)]);
      });

      await waitFor(() => {
        expect(result.current.items[0].status).toBe("error");
      });

      expect(result.current.canSave).toBe(false);
      expect(result.current.hasError).toBe(true);
      expect(result.current.isUploading).toBe(false);
    });
  });

  // ── toImageIds ─────────────────────────────────────────────────────────────

  describe("toImageIds", () => {
    it("全itemがimageId確定済みの場合、order順のimageId配列を返すこと", () => {
      const { result } = renderHook(() =>
        useImageList([
          { id: "img-1", fileSize: 100, order: 0 },
          { id: "img-2", fileSize: 100, order: 1 },
        ]),
      );

      expect(result.current.toImageIds()).toEqual(["img-1", "img-2"]);
    });

    it("imageIdが未確定のitemが含まれる場合は例外をthrowすること", () => {
      vi.mocked(imageUploadService.upload).mockReturnValueOnce(
        new Promise(() => {}),
      ); // pending

      const { result } = renderHook(() => useImageList());

      act(() => {
        result.current.addFiles([makeFile("a.jpg", 100)]);
      });

      // アップロード未完了のためimageIdはまだ未確定
      expect(() => result.current.toImageIds()).toThrow(
        "未アップロードの画像が含まれています",
      );
    });

    it("items が空の場合は空配列を返すこと", () => {
      const { result } = renderHook(() => useImageList());

      expect(result.current.toImageIds()).toEqual([]);
    });
  });

  // ── AbortController ─────────────────────────────────────────────────────────────
  
  describe("AbortController", () => {
    it("removeItem(clientId)は対応するアップロードのsignalをabortすること", () => {
      let capturedSignal: AbortSignal | undefined;
      vi.mocked(imageUploadService.upload).mockImplementationOnce(
        (_file, signal) => {
          capturedSignal = signal;
          return new Promise(() => {});
        },
      );

      const { result } = renderHook(() => useImageList());
      act(() => {
        result.current.addFiles([makeFile("a.jpg", 100)]);
      });
      const clientId = result.current.items[0].clientId;

      expect(capturedSignal?.aborted).toBe(false);

      act(() => {
        result.current.removeItem(clientId);
      });

      expect(capturedSignal?.aborted).toBe(true);
    });

    it("別のclientIdのアップロードはabortされないこと", () => {
      const signals: (AbortSignal | undefined)[] = [];
      vi.mocked(imageUploadService.upload).mockImplementation(
        (_file, signal) => {
          signals.push(signal);
          return new Promise(() => {});
        },
      );

      const { result } = renderHook(() => useImageList());
      act(() => {
        result.current.addFiles([
          makeFile("a.jpg", 100),
          makeFile("b.jpg", 100),
        ]);
      });
      const [item1] = result.current.items;

      act(() => {
        result.current.removeItem(item1.clientId);
      });

      expect(signals[0]?.aborted).toBe(true);
      expect(signals[1]?.aborted).toBe(false);
    });

    it("アンマウント時に実行中の全アップロードがabortされること", () => {
      const signals: (AbortSignal | undefined)[] = [];
      vi.mocked(imageUploadService.upload).mockImplementation(
        (_file, signal) => {
          signals.push(signal);
          return new Promise(() => {});
        },
      );

      const { result, unmount } = renderHook(() => useImageList());
      act(() => {
        result.current.addFiles([
          makeFile("a.jpg", 100),
          makeFile("b.jpg", 100),
        ]);
      });

      unmount();

      expect(signals[0]?.aborted).toBe(true);
      expect(signals[1]?.aborted).toBe(true);
    });

    it("catchでAbortErrorを受け取った場合、status='error'に変化しないこと", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      let reject!: (e: Error) => void;
      vi.mocked(imageUploadService.upload).mockImplementationOnce(
        () =>
          new Promise((_, r) => {
            reject = r;
          }),
      );

      const { result } = renderHook(() => useImageList());
      act(() => {
        result.current.addFiles([makeFile("a.jpg", 100)]);
      });

      await act(async () => {
        reject(abortError);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.items[0].status).toBe("uploading");
      expect(result.current.items[0].error).toBeUndefined();
    });
  });
});
