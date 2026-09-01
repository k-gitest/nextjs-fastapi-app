import type { Album, AlbumDetail } from "../types";

/**
 * Album（Service契約）からAlbum（REST公開DTO）への変換。
 *
 * Service契約がREST公開DTOと同じ最小契約に狭められているため、
 * 現時点では変換によるフィールド削除はない。
 * それでもRoute Handler境界で公開フィールドを明示的に列挙することで、
 * Service契約が将来広がった場合にも不要なフィールドがREST APIへ
 * 流出しないようにする。
 */
export function toAlbumDTO(album: Album): Album {
  return {
    id: album.id,
    name: album.name,
  };
}

/**
 * AlbumDetail（Service契約）からAlbumDetail（REST公開DTO）への変換。
 * 同上の理由でこの関数を維持する。
 */
export function toAlbumDetailDTO(album: AlbumDetail): AlbumDetail {
  return {
    id: album.id,
    name: album.name,
    images: album.images,
  };
}