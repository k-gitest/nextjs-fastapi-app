"use client";

import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import type { ImageSummary } from "@/features/images/types";
import { getUnassignedImagesFetch } from "./imageApi";

export const unassignedImagesQueryKey = () => ["images", "unassigned"] as const;

export const useUnassignedImages = () => {
  const { data } = useApiSuspenseQuery<ImageSummary[]>({
    queryKey: unassignedImagesQueryKey(),
    queryFn: getUnassignedImagesFetch,
    staleTime: 1000 * 5,
  });

  return { images: data };
};