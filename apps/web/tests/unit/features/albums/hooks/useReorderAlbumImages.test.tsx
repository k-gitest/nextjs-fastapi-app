import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useAlbumDetail } from "@/features/albums/hooks/useAlbumDetail";
import { useReorderAlbumImages } from "@/features/albums/hooks/useReorderAlbumImages";
import { queryClientWrapper } from "@tests/test-utils/vitest-util";
import type { AlbumDetail } from "@/features/albums/types";

const mockAlbumDetail: AlbumDetail = {
  id: "album-1",
  name: "夏休み",
  images: [
    {
      id: "img-1",
      originalFileName: "photo1.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-06-01"),
      usageCount: 0,
      albumDisplayOrder: 0,
    },
    {
      id: "img-2",
      originalFileName: "photo2.png",
      mimeType: "image/png",
      fileSize: 2000,
      createdAt: new Date("2026-06-02"),
      usageCount: 0,
      albumDisplayOrder: 1,
    },
    {
      id: "img-3",
      originalFileName: "photo3.png",
      mimeType: "image/png",
      fileSize: 3000,
      createdAt: new Date("2026-06-03"),
      usageCount: 0,
      albumDisplayOrder: 2,
    },
  ],
} as AlbumDetail;

describe("useReorderAlbumImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // useAlbumDetailとuseReorderAlbumImagesを同一QueryClient上で併用し、
  // albumDetailQueryKey(albumId)を共有していることを検証する。
  const renderPair = (albumId: string) => {
    const wrapper = queryClientWrapper();
    return renderHook(
      () => ({
        detail: useAlbumDetail(albumId),
        reorder: useReorderAlbumImages(albumId),
      }),
      { wrapper },
    );
  };

  it("並び替え成功時、reorderMutationがisSuccessになること", async () => {
    server.use(
      http.get("*/api/albums/album-1", () => HttpResponse.json(mockAlbumDetail)),
      http.patch(
        "*/api/albums/album-1/reorder",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderPair("album-1");

    await waitFor(() => {
      expect(result.current.detail.album.images).toHaveLength(3);
    });

    await act(async () => {
      await result.current.reorder.mutateAsync(["img-3", "img-1", "img-2"]);
    });

    await waitFor(() => {
      expect(result.current.reorder.isSuccess).toBe(true);
    });
  });

  it("並び替え中は楽観的更新でキャッシュ上のimages順序が即座に反映されること", async () => {
    server.use(
      http.get("*/api/albums/album-1", () => HttpResponse.json(mockAlbumDetail)),
      http.patch("*/api/albums/album-1/reorder", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderPair("album-1");

    await waitFor(() => {
      expect(result.current.detail.album.images).toHaveLength(3);
    });

    act(() => {
      result.current.reorder.mutate(["img-3", "img-1", "img-2"]);
    });

    await waitFor(() => {
      expect(result.current.detail.album.images.map((img) => img.id)).toEqual([
        "img-3",
        "img-1",
        "img-2",
      ]);
    });

    expect(
      result.current.detail.album.images.map((img) => img.albumDisplayOrder),
    ).toEqual([0, 1, 2]);
  });

  it("並び替え失敗時はロールバックされ、元の順序に戻ること", async () => {
    server.use(
      http.get("*/api/albums/album-1", () => HttpResponse.json(mockAlbumDetail)),
      http.patch("*/api/albums/album-1/reorder", () =>
        HttpResponse.json({ message: "Server Error" }, { status: 500 }),
      ),
    );

    const { result } = renderPair("album-1");

    await waitFor(() => {
      expect(result.current.detail.album.images).toHaveLength(3);
    });

    await act(async () => {
      try {
        await result.current.reorder.mutateAsync(["img-3", "img-1", "img-2"]);
      } catch {
        // エラーは期待通り
      }
    });

    await waitFor(() => {
      expect(result.current.detail.album.images.map((img) => img.id)).toEqual([
        "img-1",
        "img-2",
        "img-3",
      ]);
    });
  });
});