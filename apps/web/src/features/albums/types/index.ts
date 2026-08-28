import type { Album } from "@repo/db";
import type { ImageSummary } from "@/features/images/types";

export type { Album };

export interface CreateAlbumInput {
  name: string;
  userId: string;
}

export interface UpdateAlbumInput {
  id: string;
  name: string;
}

// NOTE: 旧名 AlbumImageItem は features/images/types へ移設した（ImageSummaryにリネーム）。
// Album詳細・未所属一覧の両方で同一構造を返すため、Album固有の型ではなくImage側の型として
// 定義し直した。既存importの互換のためここでも re-export する。
export type { ImageSummary as AlbumImageItem } from "@/features/images/types";

export type AlbumDetail = Album & {
  images: ImageSummary[];
};