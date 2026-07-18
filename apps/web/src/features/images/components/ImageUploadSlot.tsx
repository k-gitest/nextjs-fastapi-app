"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { ImageItem } from "@/features/images/types";

type ImageUploadSlotProps = {
  item: ImageItem;
  removeItem: (id: string) => void;
};

/**
 * 画像1枚分の表示を担当する、完全に受動的な（Presentational）コンポーネント。
 *
 * アップロード処理は一切持たない。アップロードは useImageList.addFiles() 内で
 * 開始され、その結果（status / attachImage / error）は item プロップとして
 * 上から渡ってくるだけ。useEffect・useImageUpload・refはこのコンポーネントには存在しない
 * （Reactのコンポーネントライフサイクルとアップロード開始タイミングを完全に分離している）。
 *
 * previewUrl は以下のいずれか:
 *   - origin="existing": `/api/images/{id}/view`（B2は非公開バケットのため、
 *     直接URLではなくRoute Handler経由の302リダイレクトで表示する。
 *     Phase1のImageUploader.tsxと同じ理由でnext/imageに unoptimized を渡す
 *     ——最適化用のリモートローダーがこのRoute Handlerの302を想定していないため）。
 *   - origin="new": URL.createObjectURL(item.file) によるローカルプレビュー。
 */
export const ImageUploadSlot = ({ item, removeItem }: ImageUploadSlotProps) => {
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-md border">
      <Image
        src={item.previewUrl}
        width={64}
        height={64}
        alt="添付画像"
        className="h-full w-full object-cover"
        unoptimized
      />

      {item.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
          アップロード中…
        </div>
      )}

      {item.status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-1 text-center text-[10px] text-white">
          {item.error ?? "アップロードに失敗しました"}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
        onClick={() => removeItem(item.id)}
        aria-label="画像を削除"
      >
        ×
      </Button>
    </div>
  );
};