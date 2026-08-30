import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useCreateAlbum } from "@/features/albums/hooks/useCreateAlbum";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";
import type { Album } from "@/features/albums/types";

const mockCreatedAlbum: Album = {
  id: "album-new",
  name: "新しいアルバム",
};

describe("useCreateAlbum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Album作成が成功すること", async () => {
    server.use(
      http.post("*/api/albums", () =>
        HttpResponse.json(mockCreatedAlbum, { status: 201 }),
      ),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useCreateAlbum(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "新しいアルバム" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("成功後にALBUM_QUERY_KEYがinvalidateされること", async () => {
    server.use(
      http.post("*/api/albums", () =>
        HttpResponse.json(mockCreatedAlbum, { status: 201 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAlbum(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "新しいアルバム" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ALBUM_QUERY_KEY });
  });

  it("作成失敗時はエラーになり、invalidateQueriesは呼ばれないこと", async () => {
    server.use(
      http.post("*/api/albums", () =>
        HttpResponse.json({ message: "同名のアルバムが既に存在します" }, { status: 409 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAlbum(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ name: "旅行" });
      } catch {
        // エラーは期待通り
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});