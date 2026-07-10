"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useImageUpload } from "@/features/images/hooks/useImageUpload";
import type { AttachImageInput } from "@/features/images/schemas";
import Image from "next/image";

interface ExistingImage {
  id: string;
  originalFileName: string;
}

interface ImageUploaderProps {
  // DB上に既に存在する添付画像（編集時のみ渡す。新規作成時はundefined）
  existingImage?: ExistingImage | null;
  // 送信予定の状態。undefined=変更なし / null=削除予定 / object=新規添付・差し替え予定
  value: AttachImageInput | null | undefined;
  onChange: (next: AttachImageInput | null | undefined) => void;
  disabled?: boolean;
}

/**
 * 画像アップロードUI。useImageUploadを内包し、
 * 親（TodoForm等ではなくTodoCreateForm/TodoEditModalのようなDialog層）へは
 * アップロード済みメタデータ（AttachImageInput）だけを返す。
 *
 * 将来Album機能でも同じコンポーネントをそのまま再利用できるよう、
 * Todo固有の知識は一切持たない。
 */
export const ImageUploader = ({
  existingImage,
  value,
  onChange,
  disabled,
}: ImageUploaderProps) => {
  const { state, upload, reset } = useImageUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    await upload(file);
  };

  // uploadが完了したら親へ通知する（useImageUploadのstateとvalue propを橋渡し）
  // render中に副作用を起こさないようuseEffectで行う
  useEffect(() => {
    if (
      state.status === "done" &&
      value?.storageKey !== state.result.storageKey
    ) {
      onChange(state.result);
    }
  }, [state, value, onChange]);

  const handleRemoveExisting = () => {
    onChange(null); // 削除予定にする（実際の削除は保存成功後）
  };

  const handleCancelPendingChange = () => {
    onChange(undefined); // 変更なしの状態へ戻す
    reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const isUploading =
    state.status === "validating" || state.status === "uploading";
  // 新規添付・差し替え「予定」（アップロード済みオブジェクト）のときだけファイル選択を隠す。
  // 削除予定（null）や変更なし（undefined）のときは選び直せるようにする。
  const showFileInput = value === undefined || value === null;

  return (
    <div className="space-y-2">
      <label className="block font-medium text-sm">添付画像</label>

      {/* 新規添付・差し替え予定 */}
      {value && (
        <div className="flex items-center justify-between rounded-md border p-2">
          <span className="text-sm truncate">
            新しい画像: {value.originalFileName}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelPendingChange}
            disabled={disabled}
          >
            取り消す
          </Button>
        </div>
      )}

      {/* 削除予定 */}
      {value === null && (
        <div className="flex items-center justify-between rounded-md border border-destructive p-2">
          <span className="text-sm text-destructive">
            画像を削除します（保存すると確定）
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelPendingChange}
            disabled={disabled}
          >
            取り消す
          </Button>
        </div>
      )}

      {/* 変更なし・既存画像あり */}
      {value === undefined && existingImage && (
        <div className="flex items-center gap-2">
          {/* allPrivateバケットのため、直接<img src>ではなくRoute Handler経由（302 Redirect）で表示 */}
          <Image
            src={`/api/images/${existingImage.id}/view`}
            width={64}
            height={64}
            alt={existingImage.originalFileName}
            className="w-16 h-16 object-cover rounded-md border"
            unoptimized
          />
          <span className="text-sm text-muted-foreground truncate flex-1">
            {existingImage.originalFileName}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemoveExisting}
            disabled={disabled}
          >
            削除
          </Button>
        </div>
      )}

      {/* ファイル選択（変更なし／削除予定のときは常に選び直せる。差し替え予定確定後は隠す） */}
      {showFileInput && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          disabled={disabled || isUploading}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
          className="text-sm"
        />
      )}

      {isUploading && (
        <p className="text-sm text-muted-foreground">アップロード中...</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </div>
  );
};
