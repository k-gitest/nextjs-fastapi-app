"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { Album } from "../types";
import { fetchAlbums } from "./albumApi";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";

export const useAlbums = () => {
  const { data } = useApiSuspenseQuery<Album[]>({
    queryKey: ALBUM_QUERY_KEY,
    queryFn: fetchAlbums,
    staleTime: 1000 * 5,
  });

  return { albums: data };
};