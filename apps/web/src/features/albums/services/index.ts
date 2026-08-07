/**
 * Album サービス切り替えスイッチ
 *
 * todos/services/index.ts と同じパターン。
 */
import { albumService as rest } from "./albumService";
import { albumServiceGraphQL as graphql } from "./albumServiceGraphQL";

const useGraphQL = {
  getAlbums: true,
  getAlbumDetail: true,
  createAlbum: true,
  updateAlbum: true,
  deleteAlbum: true,
} as const;

export const albumService = {
  getAlbums: useGraphQL.getAlbums ? graphql.getAlbums : rest.getAlbums,
  getAlbumDetail: useGraphQL.getAlbumDetail ? graphql.getAlbumDetail : rest.getAlbumDetail,
  createAlbum: useGraphQL.createAlbum ? graphql.createAlbum : rest.createAlbum,
  updateAlbum: useGraphQL.updateAlbum ? graphql.updateAlbum : rest.updateAlbum,
  deleteAlbum: useGraphQL.deleteAlbum ? graphql.deleteAlbum : rest.deleteAlbum,
};