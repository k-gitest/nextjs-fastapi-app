"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { ImageSummary } from "@/features/images/types";
import { getUnassignedImagesFetch } from "./imageApi";

export const UNASSIGNED_IMAGES_QUERY_KEY = ["images", "unassigned"] as const;

export const useUnassignedImages = () => {
  const { data } = useApiSuspenseQuery<ImageSummary[]>({
    queryKey: UNASSIGNED_IMAGES_QUERY_KEY,
    queryFn: getUnassignedImagesFetch,
    staleTime: 1000 * 5,
  });

  return { images: data };
};