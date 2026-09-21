"use client";

import { ImageUploadSlot } from "@/features/images/components/ImageUploadSlot";
import type { ImageItem } from "@/features/images/types";

type ImageGalleryProps = {
  items: ImageItem[];
  removeItem: (id: string) => void;
};

/**
 * 添付済み画像のサムネイル一覧表示のみを担当する。
 *
 * 追加UI（ローカルファイル選択・ライブラリ選択・枚数上限メッセージ・
 * addFilesのエラー表示）はImageAttachMenuへ移管した（タイトル欄の添付アイコン
 * から開く設計に変更したため）。このコンポーネントの責務は「itemsを並べて
 * ImageUploadSlotで描画する」「削除操作をremoveItemへ渡す」のみ。
 *
 * DnDによる並び替え（moveItem）はこのコンポーネントの対象外
 * （itemsはorder順にそのまま表示する。DnDは別課題として独立管理している）。
 */
export const ImageGallery = ({ items, removeItem }: ImageGalleryProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <ImageUploadSlot key={item.clientId} item={item} removeItem={removeItem} />
      ))}
    </div>
  );
};