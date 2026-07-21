"use client";

import { useUnassignedImages } from "@/features/images/hooks/useUnassignedImages";
import { useDeleteUnassignedImage } from "@/features/images/hooks/useDeleteUnassignedImage";
import { UnassignedImageGrid } from "./UnassignedImageGrid";

export const UnassignedImageContainer = () => {
  const { images } = useUnassignedImages();
  const deleteMutation = useDeleteUnassignedImage();

  const handleDelete = (imageId: string, onSuccess: () => void) => {
    deleteMutation.mutate(imageId, { onSuccess });
  };

  return (
    <UnassignedImageGrid
      images={images}
      onDelete={handleDelete}
      deleting={deleteMutation.isPending}
    />
  );
};