import { validateImageFile } from "@/features/images/lib/validate-image";
import type { AttachImageInput, PresignedUrlResponse } from "@/features/images/schemas";

/**
 * 複数画像添付（Phase2）用のアップロードService。
 *
 * Reactの状態（進捗・エラー等）は一切持たない、単純な非同期関数として実装する。
 * 状態管理は呼び出し側（useImageList）が ImageItem.status / error 経由で行う
 * （UI → hook → service という責務分離を維持するため、hookからservice、
 *  serviceからAPIという一方向の依存に閉じる）。
 *
 * NOTE: Phase1との互換性維持のため features/images/hooks/useImageUpload.ts と
 * 一時的にロジックが重複している。Phase1のUI（ImageUploader.tsx等）削除時に統合予定。
 *
 * 失敗時はErrorをthrowする。呼び出し側（useImageList.startUpload）でcatchし、
 * ImageItem.status="error" / error=message へ反映する。
 */
export const imageUploadService = {
  upload: async (file: File): Promise<AttachImageInput> => {
    const validation = await validateImageFile(file);
    if (!validation.ok) {
      const message =
        validation.reason === "too_large"
          ? "ファイルサイズが上限（10MB）を超えています"
          : "対応していないファイル形式です";
      throw new Error(message);
    }

    const presignedResponse = await fetch("/api/images/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFileName: file.name,
        mimeType: validation.mimeType,
        fileSize: file.size,
      }),
    });

    if (!presignedResponse.ok) {
      throw new Error("アップロードURLの取得に失敗しました");
    }

    const { uploadUrl, storageKey }: PresignedUrlResponse = await presignedResponse.json();

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": validation.mimeType },
      body: file,
    });

    if (!putResponse.ok) {
      throw new Error("B2へのアップロードに失敗しました");
    }

    return {
      storageKey,
      originalFileName: file.name,
      mimeType: validation.mimeType,
      fileSize: file.size,
    };
  },
};