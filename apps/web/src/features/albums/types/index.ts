import type { Album } from "@prisma/client";

export type { Album };

// 作成時: displayOrderはサービス層でMAX+1採番するため入力に含めない
export interface CreateAlbumInput {
  name: string;
  userId: string;
}

// 更新時: 現時点ではnameのみ変更可能（並び替えAPIは後続Phaseで別途追加）
export interface UpdateAlbumInput {
  id: string;
  name: string;
}

/**
 * Album詳細取得時に返す画像1件分のDTO。
 *
 * storageKeyは含めない（B2オブジェクトキーを公開しない方針）。
 * previewUrlも含めない。`/api/images/{id}/view` というルーティング知識はUI側の責務であり、
 * Todo側のImageItem生成と同様、クライアント側で `id` から組み立てる。
 *
 * usageCountはTodoImageの件数（そのImageが何件のTodoに紐づいているか）を表す派生値。
 * DBカラムではなくPrismaの_countから算出するため、サービス層でこのDTOへ明示的にマッピングし、
 * Prismaの内部表現（_count.todoImages）をRoute Handler/UIに漏らさない。
 */
export interface AlbumImageItem {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  usageCount: number;
}

export type AlbumDetail = Album & {
  images: AlbumImageItem[];
};