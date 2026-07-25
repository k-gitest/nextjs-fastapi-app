"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { ImageSummary } from "@/features/images/types";
import { getUnassignedImagesFetch } from "./imageApi";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";

export const useUnassignedImages = () => {
  const { data } = useApiSuspenseQuery<ImageSummary[]>({
    queryKey: UNASSIGNED_IMAGES_QUERY_KEY,
    queryFn: getUnassignedImagesFetch,
    staleTime: 1000 * 5,
  });

  return { images: data };
};