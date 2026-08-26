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
 * 複数画像添付用のアップロードService。
 *
 * Reactの状態（進捗・エラー等）は一切持たない、単純な非同期関数として実装する。
 * 状態管理は呼び出し側（useImageList）が ImageItem.status / error 経由で行う
 * （UI → hook → service という責務分離を維持するため、hookからservice、
 *  serviceからAPIという一方向の依存に閉じる）。
 *
 *   B2へのPUTだけでなく、続けて POST /api/images を呼び、
 *   Image作成（DB上のImage.id確定）まで完了させる。これによりTodo保存より前に
 *   Imageが必ず存在するようになり、Todo保存API側は imageId[] を受け取るだけで済む。
 *
 * NOTE: features/images/hooks/useImageUpload.ts と一部ロジック（validateImageFile→
 * presigned-url取得→B2 PUT）が重複している。useImageUpload自体はLibraryImageUploader
 * （Album画面の単体アップロードUI）から現役で利用されており統合できないため、
 * この重複は解消していない。統合する場合はuseImageUpload側のB2アップロード部分を
 * 統合するのであれば、useImageUpload側のB2アップロード部分を切り出して
 * 切り出してimageUploadServiceと共通化する形になるが、LibraryImageUploaderを含めた
 * 見直しが必要なため現時点では行っていない。
 */
export const imageUploadService = {
  upload: async (file: File, signal?: AbortSignal): Promise<UploadedImage> => {
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
      signal,
    });

    if (!presignedResponse.ok) {
      throw new Error("アップロードURLの取得に失敗しました");
    }

    const { uploadUrl, storageKey }: PresignedUrlResponse = await presignedResponse.json();

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": validation.mimeType },
      body: file,
      signal,
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
      signal,
    });

    if (!createResponse.ok) {
      throw new Error("画像の登録に失敗しました");
    }

    const created: UploadedImage = await createResponse.json();
    return created;
  },
};