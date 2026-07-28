import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useDeleteAlbum } from "@/features/albums/hooks/useDeleteAlbum";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";

describe("useDeleteAlbum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Album削除が成功すること", async () => {
    server.use(
      http.delete(
        "*/api/albums/album1",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useDeleteAlbum(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync("album1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("成功後にALBUM_QUERY_KEYがinvalidateされること", async () => {
    server.use(
      http.delete(
        "*/api/albums/album1",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteAlbum(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync("album1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ALBUM_QUERY_KEY });
  });

  it("削除失敗時はエラーになり、invalidateQueriesは呼ばれないこと", async () => {
    server.use(
      http.delete("*/api/albums/album1", () =>
        HttpResponse.json({ message: "Album not found or unauthorized" }, { status: 404 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteAlbum(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync("album1");
      } catch {
        // エラーは期待通り
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});