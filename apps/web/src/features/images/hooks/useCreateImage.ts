"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ApiError } from "@/errors/api-error";
import type { ImageSummary } from "@/features/images/types";
import type { CreateImageInput } from "@/features/images/schemas";
import { createImageFetch } from "./imageApi";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "./useUnassignedImages";

// Image作成は常にalbumId: nullで行われるため、未所属一覧のキャッシュのみ無効化すればよい
// （Album一覧・詳細には影響しない）。Albumと同様、楽観的更新は行わずinvalidateQueriesのみとする。
export const useCreateImage = () => {
  const queryClient = useQueryClient();

  return useApiMutation<ImageSummary, ApiError, CreateImageInput>({
    mutationFn: createImageFetch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: UNASSIGNED_IMAGES_QUERY_KEY });
    },
  });
};