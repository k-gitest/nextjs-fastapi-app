"use client";

import { useMemo, useRef, useState } from "react";
import { ImageUploadSlot } from "@/features/images/components/ImageUploadSlot";
import { LibraryImagePicker } from "@/features/images/components/LibraryImagePicker";
import { MAX_IMAGES_PER_TODO } from "@/features/images/schemas";
import type {
  AddFilesRejectionReason,
  AddFilesResult,
  ImageItem,
  ImageSummary,
} from "@/features/images/types";

type ImageGalleryProps = {
  items: ImageItem[];
  addFiles: (files: File[]) => AddFilesResult;
  addExistingImages: (images: ImageSummary[]) => AddFilesResult;
  removeItem: (id: string) => void;
  disabled?: boolean;
};

const ADD_FILES_ERROR_MESSAGE: Record<AddFilesRejectionReason, string> = {
  too_many: `添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`,
  too_large: "画像の合計サイズが上限を超えています",
};

/**
 * 複数画像添付の一覧表示＋追加UI（ローカル選択・ライブラリ選択の2入口）。
 *
 *   「ライブラリから選択」（LibraryImagePicker）を実装している。ImageGallery自体は
 *   Album/未所属の構造を一切知らない。LibraryImagePickerに渡すのは
 *   「現在このTodoに添付済みのimageId集合」（attachedImageIds、Picker側のdisabled表示用）と
 *   「確定時に呼ぶaddExistingImages自体」であり、Album関連のデータ取得・確定操作の成否判定・
 *   エラー表示はすべてLibraryImagePicker配下に閉じている。
 *
 *   このコンポーネントのerrorステートはローカルファイル追加（addFiles）専用。
 *   ライブラリ追加の成否・エラー表示はLibraryImagePickerが自身で完結させるため、
 *   ImageGallery側でラップするコールバックは持たない
 *   （addExistingImagesをLibraryImagePickerへそのまま渡す）。
 *
 * このコンポーネント自身はアップロードや状態管理を持たない
 * （useImageList が状態管理とアップロード開始・追加処理を担う）。
 * ここでの責務は「itemsを並べてImageUploadSlotで描画する」「ファイル選択を受け取り
 * addFiles()へ渡す」「addFiles()の検証エラーをインライン表示する」の3点のみ。
 *
 * DnDによる並び替え（moveItem）はこのコンポーネントの対象外
 * （itemsはorder順にそのまま表示する。DnDは別課題として独立管理している）。
 */
export const ImageGallery = ({
  items,
  addFiles,
  addExistingImages,
  removeItem,
  disabled,
}: ImageGalleryProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // LibraryImagePickerの「追加済み」disabled表示に使う。
  // origin="new"でアップロード未完了（imageId未確定）のitemはfilterで自然に除外される
  // （まだTodoImageとして同期される保証がないため、Library側で「追加済み」扱いにする
  //  必要はない）。
  const attachedImageIds = useMemo(
    () =>
      new Set(items.map((item) => item.imageId).filter((id): id is string => !!id)),
    [items],
  );

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const result = addFiles(Array.from(fileList));
    setError(result.ok ? null : ADD_FILES_ERROR_MESSAGE[result.reason]);

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
    <fieldset className="space-y-2 border-0 p-0 m-0">
      <legend className="block text-sm font-medium p-0">添付画像</legend>

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
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            id="todo-image-upload"
            name="todo-image-upload"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            disabled={disabled}
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="text-sm"
          />
          <LibraryImagePicker
            attachedImageIds={attachedImageIds}
            onAdd={addExistingImages}
            disabled={disabled}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
};