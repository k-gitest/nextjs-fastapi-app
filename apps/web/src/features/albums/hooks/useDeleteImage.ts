"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import { deleteImageFetch } from "@/features/images/hooks/imageApi";
import { albumDetailQueryKey } from "@/features/albums/lib/queryKeys";

type DeleteImageReq = { albumId: string; imageId: string };

/**
 * Album詳細画面からのImage削除Mutation。
 *
 * fetch関数自体（DELETE /api/images/[id]）はimagesドメインのAPIのため
 * features/images/hooks/imageApi.ts に置くが、このHook自体は
 * 「Album詳細画面のキャッシュを無効化する」というAlbum側の関心事のため
 * features/albums/hooks/ に置く。
 * 依存の向きは albums → images の一方向のみ。
 *
 * albumIdはHook生成時ではなくmutate()呼び出し時に渡す。
 * これにより、別Albumへの画像移動や複数Album横断画面など、
 * albumIdが呼び出しごとに変わるユースケースでもHook自体を作り直さずに済む（再利用性を優先した設計）。
 */
export const useDeleteImage = () => {
  const queryClient = useQueryClient();

  return useApiMutation<void, ApiError, DeleteImageReq>({
    mutationFn: ({ imageId }) => deleteImageFetch(imageId),
    onSuccess: async (_data, { albumId }) => {
      await queryClient.invalidateQueries({ queryKey: albumDetailQueryKey(albumId) });
    },
  });
};