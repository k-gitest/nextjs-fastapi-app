import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useAlbumDetail } from "@/features/albums/hooks/useAlbumDetail";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { albumDetailQueryKey } from "@/features/albums/lib/queryKeys";
import type { AlbumDetail } from "@/features/albums/types";

const mockAlbumDetail: AlbumDetail = {
  id: "album1",
  name: "旅行",
  images: [
    {
      id: "img1",
      originalFileName: "beach.jpg",
      mimeType: "image/jpeg",
      fileSize: 2048,
      createdAt: new Date(),
      usageCount: 1,
      albumDisplayOrder: 0,
    },
  ],
};

describe("useAlbumDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("指定したidのAlbum詳細を取得できる", async () => {
    server.use(
      http.get("*/api/albums/album1", () => HttpResponse.json(mockAlbumDetail)),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAlbumDetail("album1"), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.album.name).toBe("旅行");
    });

    expect(result.current.album.images).toHaveLength(1);
    expect(result.current.album.images[0].usageCount).toBe(1);
  });

  it("idに応じて異なるエンドポイントを呼び出すこと", async () => {
    let calledPath = "";
    server.use(
      http.get("*/api/albums/:id", ({ params }) => {
        calledPath = params.id as string;
        return HttpResponse.json({ ...mockAlbumDetail, id: params.id });
      }),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAlbumDetail("album2"), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.album.id).toBe("album2");
    });

    expect(calledPath).toBe("album2");
  });

  it("albumDetailQueryKeyでキャッシュされること", async () => {
    server.use(
      http.get("*/api/albums/album1", () => HttpResponse.json(mockAlbumDetail)),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const { result } = renderHook(() => useAlbumDetail("album1"), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.album.name).toBe("旅行");
    });

    const cached = queryClient.getQueryData<AlbumDetail>(albumDetailQueryKey("album1"));
    expect(cached?.id).toBe("album1");
    expect(cached?.images).toHaveLength(1);
  });
});