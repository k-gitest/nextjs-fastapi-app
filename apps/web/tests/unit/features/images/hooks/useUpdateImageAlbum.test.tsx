import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";
import type { ImageSummary } from "@/features/images/types";

const mockUpdatedImage: ImageSummary = {
  id: "img-1",
  originalFileName: "photo1.png",
  mimeType: "image/png",
  fileSize: 1000,
  createdAt: new Date(),
  usageCount: 0,
};

describe("useUpdateImageAlbum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Album割り当てが成功すること（albumIdを指定）", async () => {
    server.use(
      http.patch("*/api/images/img-1", () => HttpResponse.json(mockUpdatedImage)),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useUpdateImageAlbum(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ imageId: "img-1", albumId: "album-1" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("未所属へ戻す操作（albumId: null）も成功すること", async () => {
    server.use(
      http.patch("*/api/images/img-1", () => HttpResponse.json(mockUpdatedImage)),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useUpdateImageAlbum(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ imageId: "img-1", albumId: null });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("成功後にUNASSIGNED_IMAGES_QUERY_KEYと[\"albums\"]の両方がinvalidateされること", async () => {
    server.use(
      http.patch("*/api/images/img-1", () => HttpResponse.json(mockUpdatedImage)),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateImageAlbum(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ imageId: "img-1", albumId: "album-1" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: UNASSIGNED_IMAGES_QUERY_KEY,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["albums"] });
  });

  it("更新失敗時はエラーになり、invalidateQueriesは呼ばれないこと", async () => {
    server.use(
      http.patch("*/api/images/img-1", () =>
        HttpResponse.json({ message: "Not found or unauthorized" }, { status: 404 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateImageAlbum(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ imageId: "img-1", albumId: "album-1" });
      } catch {
        // エラーは期待通り
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});