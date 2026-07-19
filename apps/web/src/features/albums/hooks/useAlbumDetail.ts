"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { AlbumDetail } from "../types";
import { fetchAlbumDetail } from "./albumApi";

export const albumDetailQueryKey = (id: string) => ["albums", id] as const;

export const useAlbumDetail = (id: string) => {
  const { data } = useApiSuspenseQuery<AlbumDetail>({
    queryKey: albumDetailQueryKey(id),
    queryFn: () => fetchAlbumDetail(id),
    staleTime: 1000 * 5,
  });

  return { album: data };
};