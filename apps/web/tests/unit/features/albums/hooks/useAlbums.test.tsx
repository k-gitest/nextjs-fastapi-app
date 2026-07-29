import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";
import type { Album } from "@/features/albums/types";

const mockAlbums: Album[] = [
  {
    id: "album1",
    name: "旅行",
    userId: "user1",
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "album2",
    name: "仕事",
    userId: "user1",
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("useAlbums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Album一覧を取得できる", async () => {
    server.use(http.get("*/api/albums", () => HttpResponse.json(mockAlbums)));

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(2);
    });

    expect(result.current.albums[0].name).toBe("旅行");
    expect(result.current.albums[1].name).toBe("仕事");
  });

  it("Album一覧が空の場合は空配列を返す", async () => {
    server.use(http.get("*/api/albums", () => HttpResponse.json([])));

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(0);
    });
  });

  it("ALBUM_QUERY_KEYでキャッシュされること", async () => {
    server.use(http.get("*/api/albums", () => HttpResponse.json(mockAlbums)));

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(2);
    });

    const cached = queryClient.getQueryData<Album[]>(ALBUM_QUERY_KEY);
    expect(cached).toHaveLength(2);
    expect(cached?.map((a) => a.id)).toEqual(["album1", "album2"]);
  });
});