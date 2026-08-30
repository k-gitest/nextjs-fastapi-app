import type { Album as PrismaAlbum } from "@repo/db";
import type { ImageSummary } from "@/features/images/types";

export type { PrismaAlbum };

/**
 * Album公開DTO（REST API境界での公開契約）。
 *
 * PrismaのAlbumモデルをそのまま公開せず、UIが実際に必要とするフィールドのみで
 * 構成する（README.md「公開DTOの設計原則」）。
 *
 * 除外するフィールドと理由:
 * - userId: 所有権情報。Service層内部でのownership checkにのみ必要で、
 *   UIはこの値を必要としない（自分自身のIDであり第三者への漏洩ではないが、
 *   「UIが必要とする情報のみで構成する」原則には反するため除外）。
 * - displayOrder: 現時点でUIのどこも参照していない（表示順はサーバー側の
 *   orderByで完結している）。DnD機能等で必要になった時点で明示的に追加する。
 * - createdAt / updatedAt: 同上、UIのどこも参照していない。
 *
 * 将来的にこれらのフィールドが必要になった場合は、都度この型定義を
 * 明示的に変更すること（公開範囲の拡大を「気づかないまま」発生させないため）。
 *
 * このDTOはREST Route Handler境界（albumMapper.ts）でのみ適用する。
 * Service層・GraphQL ResolverはPrismaAlbum（内部型）を扱う
 * （GraphQL ResolverはService層を直接importするため、Serviceの戻り値を
 * このDTOで狭めるとGraphQL側の実装・schemaまで巻き込んでしまう。
 * GraphQL側の公開フィールド整理は別Issueで扱う）。
 */
export interface Album {
  id: string;
  name: string;
}

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

/**
 * Album詳細の内部型（Service層・GraphQL Resolver用）。
 * PrismaAlbumの全フィールド + images。REST公開時はalbumMapper.tsの
 * toAlbumDetailDTOでAlbumDetail（公開DTO）に変換する。
 */
export type AlbumDetailInternal = PrismaAlbum & {
  images: ImageSummary[];
};

/**
 * Album詳細の公開DTO（REST API境界）。
 * トップレベルはAlbum（公開DTO）と同じ絞り込みルールに従う。
 */
export type AlbumDetail = Album & {
  images: ImageSummary[];
};