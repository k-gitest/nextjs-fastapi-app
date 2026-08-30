import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useUpdateAlbum } from "@/features/albums/hooks/useUpdateAlbum";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";
import type { Album } from "@/features/albums/types";

const mockUpdatedAlbum: Album = {
  id: "album1",
  name: "更新後の名前",
};

describe("useUpdateAlbum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Album更新が成功すること", async () => {
    server.use(
      http.patch("*/api/albums/album1", () => HttpResponse.json(mockUpdatedAlbum)),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useUpdateAlbum(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "album1", name: "更新後の名前" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("成功後にALBUM_QUERY_KEYがinvalidateされること", async () => {
    server.use(
      http.patch("*/api/albums/album1", () => HttpResponse.json(mockUpdatedAlbum)),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateAlbum(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "album1", name: "更新後の名前" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ALBUM_QUERY_KEY });
  });

  it("更新失敗時はエラーになり、invalidateQueriesは呼ばれないこと", async () => {
    server.use(
      http.patch("*/api/albums/album1", () =>
        HttpResponse.json({ message: "Album not found or unauthorized" }, { status: 404 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateAlbum(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: "album1", name: "更新後の名前" });
      } catch {
        // エラーは期待通り
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});