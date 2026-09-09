"use client";

import { useUnassignedImages } from "@/features/images/hooks/useUnassignedImages";
import { useDeleteUnassignedImage } from "@/features/images/hooks/useDeleteUnassignedImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { UnassignedImageGrid } from "./UnassignedImageGrid";

type UnassignedImageContainerProps = {
  excludeImageId?: string | null;
};

export const UnassignedImageContainer = ({
  excludeImageId,
}: UnassignedImageContainerProps) => {
  const { images } = useUnassignedImages();
  const { albums } = useAlbums();

  const deleteMutation = useDeleteUnassignedImage();
  const updateAlbumMutation = useUpdateImageAlbum();
  const visibleImages = excludeImageId
    ? images.filter((image) => image.id !== excludeImageId)
    : images;

  const handleDelete = (imageId: string, onSuccess: () => void) => {
    deleteMutation.mutate(imageId, { onSuccess });
  };

  const handleUpdateAlbum = (imageId: string, albumId: string) => {
    updateAlbumMutation.mutate({ imageId, albumId });
  };

  return (
    <UnassignedImageGrid
      images={visibleImages}
      albums={albums}
      onDelete={handleDelete}
      onUpdateAlbum={handleUpdateAlbum}
      deleting={deleteMutation.isPending}
      assigning={updateAlbumMutation.isPending}
    />
  );
};
