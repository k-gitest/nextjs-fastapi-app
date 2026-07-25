"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import { deleteAlbumFetch } from "./albumApi";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";

export const useDeleteAlbum = () => {
  const queryClient = useQueryClient();

  return useApiMutation<void, ApiError, string>({
    mutationFn: deleteAlbumFetch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ALBUM_QUERY_KEY });
    },
  });
};