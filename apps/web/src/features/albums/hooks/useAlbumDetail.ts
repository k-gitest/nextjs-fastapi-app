"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { AlbumDetail } from "../types";
import { fetchAlbumDetail } from "./albumApi";
import { albumDetailQueryKey } from "@/features/albums/lib/queryKeys";

export const useAlbumDetail = (id: string) => {
  const { data } = useApiSuspenseQuery<AlbumDetail>({
    queryKey: albumDetailQueryKey(id),
    queryFn: () => fetchAlbumDetail(id),
    staleTime: 1000 * 5,
  });

  return { album: data };
};