"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { Album } from "../types";
import { fetchAlbums } from "./albumApi";

export const ALBUM_QUERY_KEY = ["albums"] as const;

export const useAlbums = () => {
  const { data } = useApiSuspenseQuery<Album[]>({
    queryKey: ALBUM_QUERY_KEY,
    queryFn: fetchAlbums,
    staleTime: 1000 * 5,
  });

  return { albums: data };
};