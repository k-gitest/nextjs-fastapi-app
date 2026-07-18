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