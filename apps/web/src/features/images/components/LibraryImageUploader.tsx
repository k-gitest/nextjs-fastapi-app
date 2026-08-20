"use client";

import { useEffect, useRef } from "react";
import { useImageUpload } from "@/features/images/hooks/useImageUpload";
import { useCreateImage } from "@/features/images/hooks/useCreateImage";
import { Input } from "@/components/ui/input";

/**
 * ライブラリ画面（AlbumPanel）専用のアップローダー。
 *
 * 責務: ファイル選択 → B2アップロード → Image作成（albumId: null）まで。
 * 作成後の紐付け（Album所属・Todo利用等）は一切扱わない。
 *
 * Todo側の ImageGallery / useImageList とは別コンポーネントとして独立させている。
 * 理由: ImageGallery / useImageList は複数画像を扱い、Todo保存時に同期する
 * items配列（表示順・Todoとの利用関係）を管理するTodo編集フォーム向けの設計である。
 * 一方こちらは単一画像を選択した時点でImage作成まで完了し、
 * 後続のTodoとの紐付けを扱わない単純なアップロードフローであるため、両者を分離している。
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
      <Input
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