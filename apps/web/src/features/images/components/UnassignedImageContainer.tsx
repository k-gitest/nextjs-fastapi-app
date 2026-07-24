"use client";

import { useUnassignedImages } from "@/features/images/hooks/useUnassignedImages";
import { useDeleteUnassignedImage } from "@/features/images/hooks/useDeleteUnassignedImage";
import { useUpdateImageAlbum } from "@/features/images/hooks/useUpdateImageAlbum";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { UnassignedImageGrid } from "./UnassignedImageGrid";
//import type { Album } from "@/features/albums/types";

export const UnassignedImageContainer = () => {
  const { images } = useUnassignedImages();
  const { albums } = useAlbums();
  //const albums: Album[] = []
  const deleteMutation = useDeleteUnassignedImage();
  const updateAlbumMutation = useUpdateImageAlbum();

  const handleDelete = (imageId: string, onSuccess: () => void) => {
    deleteMutation.mutate(imageId, { onSuccess });
  };

  const handleUpdateAlbum = (imageId: string, albumId: string) => {
    updateAlbumMutation.mutate({ imageId, albumId });
  };

  return (
    <UnassignedImageGrid
      images={images}
      albums={albums}
      onDelete={handleDelete}
      onUpdateAlbum={handleUpdateAlbum}
      deleting={deleteMutation.isPending}
      assigning={updateAlbumMutation.isPending}
    />
  );
};