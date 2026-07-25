"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import { deleteImageFetch } from "@/features/images/hooks/imageApi";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";

/**
 * 未所属画像一覧（AlbumPanel）からのImage削除Mutation。
 *
 * features/albums/hooks/useDeleteImage.ts と役割は対だが、キャッシュの
 * 無効化対象が異なるため専用に用意する（Album側はalbumIdごとのAlbumDetail、
 * こちらはUNASSIGNED_IMAGES_QUERY_KEYの1つのみ）。
 * albumIdの概念を持たないため、mutationFnの入力はimageIdのみ。
 */
export const useDeleteUnassignedImage = () => {
  const queryClient = useQueryClient();

  return useApiMutation<void, ApiError, string>({
    mutationFn: (imageId) => deleteImageFetch(imageId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: UNASSIGNED_IMAGES_QUERY_KEY });
    },
  });
};