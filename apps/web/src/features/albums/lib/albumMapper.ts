import type { Album, AlbumDetail, PrismaAlbum, AlbumDetailInternal } from "../types";

/**
 * PrismaAlbum（内部型）からAlbum（REST公開DTO）への変換。
 *
 * userId・displayOrder・createdAt・updatedAtを含めない
 * （README.md「公開DTOの設計原則」、features/albums/types/index.tsのAlbum定義コメント参照）。
 *
 * GraphQL側はこのmapperを経由せずPrismaAlbumを直接扱う
 * （GraphQL側の公開フィールド整理は別Issueで扱うため、本mapperの適用範囲は
 * REST Route Handlerのみ）。
 */
export function toAlbumDTO(album: PrismaAlbum): Album {
  return {
    id: album.id,
    name: album.name,
  };
}

/**
 * AlbumDetailInternal（内部型）からAlbumDetail（REST公開DTO）への変換。
 *
 * imagesは既にalbumService.getAlbumDetail内でImageSummary形状に
 * 絞り込み済みのため、ここではトップレベル（Album本体相当の部分）のみ
 * 絞り込みを行う。
 */
export function toAlbumDetailDTO(album: AlbumDetailInternal): AlbumDetail {
  return {
    id: album.id,
    name: album.name,
    images: album.images,
  };
}