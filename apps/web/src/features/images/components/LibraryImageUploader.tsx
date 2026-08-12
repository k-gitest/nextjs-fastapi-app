"use client";

import { useEffect, useRef } from "react";
import { useImageUpload } from "@/features/images/hooks/useImageUpload";
import { useCreateImage } from "@/features/images/hooks/useCreateImage";

/**
 * ライブラリ画面（AlbumPanel）専用のアップローダー。
 *
 * 責務: ファイル選択 → B2アップロード → Image作成（albumId: null）まで。
 * 作成後の紐付け（Album所属・Todo利用等）は一切扱わない。
 *
 * useImageUpload（アップロード処理）を土台にした薄いラッパーであり、
 * Todo側の ImageUploader とは別コンポーネントとして独立させている。
 * 理由: ImageUploader は「変更予定を保持し、Todo保存時に確定する」という
 * 3値状態（undefined/null/AttachImageInput）を扱うTodo編集フォーム固有の設計であり、
 * こちらは「選択したら即座にImage作成を確定する」という単純なフローのため、
 * 保留状態を持たない。
 */
export const LibraryImageUploader = () => {
  const { state, upload, reset } = useImageUpload();
  const createImageMutation = useCreateImage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    await upload(file);
  };

  // アップロード完了 → 即座にImage作成APIを叩く
  useEffect(() => {
    if (state.status === "done") {
      createImageMutation.mutate(state.result, {
        onSuccess: () => {
          reset();
          if (inputRef.current) inputRef.current.value = "";
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const isUploading = state.status === "validating" || state.status === "uploading";
  const isBusy = isUploading || createImageMutation.isPending;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        disabled={isBusy}
        onChange={(e) => handleFileSelect(e.target.files?.[0])}
        className="text-sm"
      />
      {isUploading && <p className="text-sm text-muted-foreground">アップロード中...</p>}
      {createImageMutation.isPending && (
        <p className="text-sm text-muted-foreground">画像を登録中...</p>
      )}
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {createImageMutation.isError && (
        <p className="text-sm text-destructive">{createImageMutation.error.message}</p>
      )}
    </div>
  );
};