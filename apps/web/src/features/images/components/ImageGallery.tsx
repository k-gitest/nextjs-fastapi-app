"use client";

import { useRef, useState } from "react";
import { ImageUploadSlot } from "@/features/images/components/ImageUploadSlot";
import { MAX_IMAGES_PER_TODO } from "@/features/images/schemas";
import type {
  AddFilesRejectionReason,
  AddFilesResult,
  ImageItem,
} from "@/features/images/types";

type ImageGalleryProps = {
  items: ImageItem[];
  addFiles: (files: File[]) => AddFilesResult;
  removeItem: (id: string) => void;
  disabled?: boolean;
};

const ADD_FILES_ERROR_MESSAGE: Record<AddFilesRejectionReason, string> = {
  too_many: `添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`,
  too_large: "画像の合計サイズが上限を超えています",
};

/**
 * 複数画像添付の一覧表示＋ファイル選択UI。
 *
 * このコンポーネント自身はアップロードや状態管理を持たない
 * （useImageList が状態管理とアップロード開始を担う）。
 * ここでの責務は「itemsを並べてImageUploadSlotで描画する」「ファイル選択を受け取り
 * addFiles()へ渡す」「addFiles()の検証エラーをインライン表示する」の3点のみ。
 *
 * DnDによる並び替え（moveItem）は今回のPRのスコープ外
 * （別PRで実装予定。並び替えUIが確定するまではitemsをorder順にそのまま表示するだけ）。
 */
export const ImageGallery = ({
  items,
  addFiles,
  removeItem,
  disabled,
}: ImageGalleryProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 枚数・合計サイズが変化した（追加成功・削除等）ことを「制限超過の状況が変わった」とみなし、
  // 直前に表示していたaddFilesの検証エラーをクリアする。
  // [items] 依存だと、無関係な status 更新（uploading→done等、枚数・サイズは不変）でも
  // items配列の参照自体は変わるため、意図せずエラーが消えてしまう。
  // itemCount/totalSizeという「制限判定に使う値そのもの」を依存にすることで、
  // 本当に状況が変わったときだけクリアされるようにする
  // （エラー発生時はaddFilesが早期returnするためitemCount/totalSizeは変化せず、
  //  このeffectは発火しない＝エラーは消えない、という対比になっている）。
  /*
  const itemCount = items.length;
  const totalSize = items.reduce((sum, item) => sum + item.fileSize, 0);

  useEffect(() => {
    setError(null);
  }, [itemCount, totalSize]);
  */

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const result = addFiles(Array.from(fileList));
    setError(result.ok ? null : ADD_FILES_ERROR_MESSAGE[result.reason]);

    // 同じファイルを連続して選び直しても onChange が発火するようにリセットする
    // （同一ファイル選択時にonChangeが発火しないというinput要素の仕様への対処）。
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const reachedLimit = items.length >= MAX_IMAGES_PER_TODO;

  const handleRemoveItem = (id: string) => {
    setError(null);
    removeItem(id);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">添付画像</label>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <ImageUploadSlot
              key={item.clientId}
              item={item}
              removeItem={handleRemoveItem}
            />
          ))}
        </div>
      )}

      {reachedLimit ? (
        <p className="text-sm text-muted-foreground">
          添付できる画像は最大{MAX_IMAGES_PER_TODO}枚です
        </p>
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          disabled={disabled}
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="text-sm"
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
