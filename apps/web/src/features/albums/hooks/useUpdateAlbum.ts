"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { Album } from "../types";
import { updateAlbumFetch } from "./albumApi";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";

type UpdateAlbumReq = { id: string; name: string };

export const useUpdateAlbum = () => {
  const queryClient = useQueryClient();

  return useApiMutation<Album, ApiError, UpdateAlbumReq>({
    mutationFn: updateAlbumFetch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ALBUM_QUERY_KEY });
    },
  });
};