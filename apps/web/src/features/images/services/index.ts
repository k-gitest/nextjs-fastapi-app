/**
 * Image サービス切り替えスイッチ
 *
 * albums/todos の services/index.ts と同じパターン。
 */
import { imageService as rest } from "./imageService";
import { imageServiceGraphQL as graphql } from "./imageServiceGraphQL";

const useGraphQL = {
  getUnassignedImages: true,
  deleteImage: true,
  updateImageAlbum: true,
} as const;

export const imageService = {
  getUnassignedImages: useGraphQL.getUnassignedImages
    ? graphql.getUnassignedImages
    : rest.getUnassignedImages,
  deleteImage: useGraphQL.deleteImage ? graphql.deleteImage : rest.deleteImage,
  updateImageAlbum: useGraphQL.updateImageAlbum
    ? graphql.updateImageAlbum
    : rest.updateImageAlbum,
};