import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useDeleteImage } from "@/features/albums/hooks/useDeleteImage";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { albumDetailQueryKey } from "@/features/albums/lib/queryKeys";

describe("useDeleteImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Image削除が成功すること", async () => {
    server.use(
      http.delete(
        "*/api/images/img1",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useDeleteImage(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ albumId: "album1", imageId: "img1" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("成功後に該当albumIdのalbumDetailQueryKeyがinvalidateされること", async () => {
    server.use(
      http.delete(
        "*/api/images/img1",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteImage(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ albumId: "album1", imageId: "img1" });
    });

    // 現状はAlbum詳細のみ更新する。
    // Album一覧のinvalidate要否は一覧表示項目（imageCount等）の
    // 仕様変更時に再検討する。
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: albumDetailQueryKey("album1"),
    });
  });

  it("削除失敗時はエラーになり、invalidateQueriesは呼ばれないこと", async () => {
    server.use(
      http.delete("*/api/images/img1", () =>
        HttpResponse.json({ message: "Image not found or unauthorized" }, { status: 404 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteImage(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ albumId: "album1", imageId: "img1" });
      } catch {
        // エラーは期待通り
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});