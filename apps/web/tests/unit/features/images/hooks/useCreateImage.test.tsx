import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useCreateImage } from "@/features/images/hooks/useCreateImage";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";
import type { ImageSummary } from "@/features/images/types";
import type { CreateImageInput } from "@/features/images/schemas";

const mockCreatedImage: ImageSummary = {
  id: "img-1",
  originalFileName: "photo1.png",
  mimeType: "image/png",
  fileSize: 1000,
  createdAt: new Date(),
  usageCount: 0,
};

const mockInput: CreateImageInput = {
  storageKey: "storage-key-1",
  originalFileName: "photo1.png",
  mimeType: "image/png",
  fileSize: 1000,
} as CreateImageInput;

describe("useCreateImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Image作成が成功すること", async () => {
    server.use(
      http.post("*/api/images", () => HttpResponse.json(mockCreatedImage)),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useCreateImage(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(mockInput);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("成功後にUNASSIGNED_IMAGES_QUERY_KEYがinvalidateされること", async () => {
    server.use(
      http.post("*/api/images", () => HttpResponse.json(mockCreatedImage)),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateImage(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(mockInput);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: UNASSIGNED_IMAGES_QUERY_KEY,
    });
  });

  it("作成失敗時はエラーになり、invalidateQueriesは呼ばれないこと", async () => {
    server.use(
      http.post("*/api/images", () =>
        HttpResponse.json({ message: "Invalid input" }, { status: 400 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateImage(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync(mockInput);
      } catch {
        // エラーは期待通り
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});