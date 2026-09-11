"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { AlbumDetail, AlbumImageItem } from "../types";
import { reorderAlbumImagesFetch } from "./albumApi";
import { albumDetailQueryKey } from "@/features/albums/lib/queryKeys";

type ReorderAlbumImagesVariables = {
  albumId: string;
  imageIds: string[];
};

/**
 * Album内画像の並び替え。楽観的更新でドラッグ確定と同時にUIへ反映し、
 * 失敗時はrollbackする。成功・失敗いずれの場合もonSettledでサーバー状態を
 * 再取得し最終的な整合を取る。
 *
 * albumIdはhook引数ではなくmutation variablesとして受け取る。
 * AlbumPanel（Album間DnD）がDndContextを一元管理し、
 * どのAlbumで並び替えが発生するかがドラッグの都度動的に決まるため、
 * hookインスタンスを1つだけ生成しvariables経由でalbumIdを渡す設計とした
 * （hookのmutation入力契約変更。呼び出し元は`AlbumDetailContainer`から
 * `AlbumPanel`へ移る）。
 *
 * 楽観的更新・rollback・invalidateのライフサイクル自体は変更しない。
 */
export const useReorderAlbumImages = () => {
  const queryClient = useQueryClient();

  return useApiMutation<
    void,
    ApiError,
    ReorderAlbumImagesVariables,
    { previousDetail: AlbumDetail | undefined; albumId: string }
  >({
    mutationFn: ({ albumId, imageIds }) =>
      reorderAlbumImagesFetch(albumId, imageIds),
    onMutate: async ({ albumId, imageIds }) => {
      const queryKey = albumDetailQueryKey(albumId);
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

      return { previousDetail, albumId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          albumDetailQueryKey(context.albumId),
          context.previousDetail,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: albumDetailQueryKey(variables.albumId),
      });
    },
  });
};