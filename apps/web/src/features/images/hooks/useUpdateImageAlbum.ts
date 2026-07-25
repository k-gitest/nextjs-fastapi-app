"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { ImageSummary } from "@/features/images/types";
import { updateImageAlbumFetch } from "@/features/images/hooks/imageApi";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";

/**
 * Imageの所属Album変更Mutation（未所属⇔Album間、Album間移動を含む汎用操作）。
 * 現状の呼び出し元は未所属一覧（AlbumPanel）のみだが、Album詳細画面からの
 * 「別Albumへ移動」「未所属へ戻す」実装時もこのフックをそのまま使う想定。
 *
 * 成功すると対象Imageの所属先が変わり、旧所属（未所属 or 元Album）・新所属
 * （Album or 未所属）双方の一覧に影響しうる。Album詳細のクエリキーは
 * ["albums", albumId]（useAlbumDetail参照）で ["albums"] をprefixとしているため、
 * albumsクエリ全体を無効化すればAlbum詳細も含めて再取得される。
 */
export const useUpdateImageAlbum = () => {
  const queryClient = useQueryClient();

  return useApiMutation<
    ImageSummary,
    ApiError,
    { imageId: string; albumId: string | null }
  >({
    mutationFn: updateImageAlbumFetch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: UNASSIGNED_IMAGES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["albums"] });
    },
  });
};