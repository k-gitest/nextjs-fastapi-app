"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { AlbumDetail, AlbumImageItem } from "../types";
import { reorderAlbumImagesFetch } from "./albumApi";
import { albumDetailQueryKey } from "@/features/albums/lib/queryKeys";

/**
 * Album内画像の並び替え。楽観的更新でドラッグ確定と同時にUIへ反映し、
 * 失敗時はrollbackする。成功・失敗いずれの場合もonSettledでサーバー状態を
 * 再取得し最終的な整合を取る。
 */
export const useReorderAlbumImages = (albumId: string) => {
  const queryClient = useQueryClient();
  const queryKey = albumDetailQueryKey(albumId);

  return useApiMutation<
    void,
    ApiError,
    string[],
    { previousDetail: AlbumDetail | undefined }
  >({
    mutationFn: (imageIds) => reorderAlbumImagesFetch(albumId, imageIds),
    onMutate: async (imageIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previousDetail = queryClient.getQueryData<AlbumDetail>(queryKey);

      queryClient.setQueryData<AlbumDetail>(queryKey, (old) => {
        if (!old) return old;
        const imageMap = new Map(old.images.map((img) => [img.id, img]));
        const reordered = imageIds
          .map((id, index) => {
            const img = imageMap.get(id);
            return img ? { ...img, albumDisplayOrder: index } : undefined;
          })
          .filter((img): img is AlbumImageItem => img !== undefined);
        return { ...old, images: reordered };
      });

      return { previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKey, context.previousDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
};