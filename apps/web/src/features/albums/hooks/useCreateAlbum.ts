"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { Album } from "../types";
import { createAlbumFetch } from "./albumApi";
import { ALBUM_QUERY_KEY } from "./useAlbums";

type CreateAlbumReq = { name: string };

// Albumは操作頻度が低いため楽観的更新は行わず、成功時のinvalidateQueriesのみで十分と判断する
// （Todoの楽観的更新パターンとは異なる、YAGNI。displayOrder/DnD導入時に再検討する）。
export const useCreateAlbum = () => {
  const queryClient = useQueryClient();

  return useApiMutation<Album, ApiError, CreateAlbumReq>({
    mutationFn: createAlbumFetch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ALBUM_QUERY_KEY });
    },
  });
};