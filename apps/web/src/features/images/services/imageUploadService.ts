import { validateImageFile } from "@/features/images/lib/validate-image";
import type { PresignedUrlResponse, CreateImageInput } from "@/features/images/schemas";

/**
 * POST /api/images の成功レスポンスから、複数画像添付フローが実際に必要とする
 * フィールドだけを取り出した型。
 *
 * ImageSummary（features/images/types）を流用しない理由:
 *   - ImageSummary.createdAt は Date 型だが、fetchのJSONレスポンスでは
 *     ISO文字列になるため、そのまま型として使うと実態と乖離する
 *   - usageCount / createdAt はこのフロー（アップロード直後）では不要
 * ここでは fetch レスポンスの実態に忠実な型として個別に定義する。
 */
export type UploadedImage = {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
};

/**
 * 複数画像添付（Phase2/PR3）用のアップロードService。
 *
 * Reactの状態（進捗・エラー等）は一切持たない、単純な非同期関数として実装する。
 * 状態管理は呼び出し側（useImageList）が ImageItem.status / error 経由で行う
 * （UI → hook → service という責務分離を維持するため、hookからservice、
 *  serviceからAPIという一方向の依存に閉じる）。
 *
 * PR3での変更点:
 *   B2へのPUTだけで完了していた旧フローから、続けて POST /api/images を呼び、
 *   Image作成（DB上のImage.id確定）まで完了させる。これによりTodo保存より前に
 *   Imageが必ず存在するようになり、Todo保存API側は imageId[] を受け取るだけで済む。
 *
 * NOTE: Phase1との互換性維持のため features/images/hooks/useImageUpload.ts と
 * 一時的にロジックが重複している。Phase1のUI（ImageUploader.tsx等）削除時に統合予定。
 *
 * 失敗時はErrorをthrowする。呼び出し側（useImageList.startUpload）でcatchし、
 * ImageItem.status="error" / error=message へ反映する。
 * B2 PUT成功後にPOST /api/imagesが失敗した場合、B2上には孤立オブジェクトが残りうるが、
 * これは既存の「Presigned Uploadの特性」（README参照）で許容されている孤立オブジェクトと
 * 同じ性質のため、ここで追加の補償処理は行わない。
 */
export const imageUploadService = {
  upload: async (file: File): Promise<UploadedImage> => {
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

    const createImageBody: CreateImageInput = {
      storageKey,
      originalFileName: file.name,
      mimeType: validation.mimeType,
      fileSize: file.size,
    };

    const createResponse = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createImageBody),
    });

    if (!createResponse.ok) {
      throw new Error("画像の登録に失敗しました");
    }

    const created: UploadedImage = await createResponse.json();
    return created;
  },
};