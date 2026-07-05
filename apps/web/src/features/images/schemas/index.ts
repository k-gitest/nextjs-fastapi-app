import { z } from "zod";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// originalFileNameは表示専用。B2のオブジェクトキー生成には絶対に使わない
// （キーは常にサーバー側でUUID + 日付プレフィックスから生成する）。
// ディレクトリ区切り文字を含む場合はbasename相当まで切り詰める。
const sanitizeOriginalFileName = (name: string): string => {
  const base = name.split(/[/\\]/).pop();
  return base && base.length > 0 ? base : name;
};

const originalFileNameSchema = z.string().min(1).max(255).transform(sanitizeOriginalFileName);

// mimeType はクライアント側でマジックバイト判定済みの値を前提とする
// （features/images/lib/validate-image.ts の detectMimeTypeFromFile を参照）。
// クライアントの File.type（申告値）をそのまま渡してはいけない。
const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);

// POST /api/images/presigned-url のリクエストボディ
// サーバー側でもMIME・サイズを再検証する（クライアント申告値を信用しない）
export const presignedUrlRequestSchema = z.object({
  originalFileName: originalFileNameSchema,
  mimeType: mimeTypeSchema,
  fileSize: z.number().int().positive().max(MAX_IMAGE_FILE_SIZE_BYTES),
});
export type PresignedUrlRequest = z.infer<typeof presignedUrlRequestSchema>;

export const presignedUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string(),
});
export type PresignedUrlResponse = z.infer<typeof presignedUrlResponseSchema>;

// アップロード済み画像のメタデータ（B2へのPUTが完了した後に得られる）
export const attachImageInputSchema = z.object({
  storageKey: z.string().min(1),
  originalFileName: originalFileNameSchema,
  mimeType: mimeTypeSchema,
  fileSize: z.number().int().positive().max(MAX_IMAGE_FILE_SIZE_BYTES),
});
export type AttachImageInput = z.infer<typeof attachImageInputSchema>;

// Todo作成・更新時に渡す画像パラメータ（ImageActionのdiscriminated unionは廃止）
// undefined = 変更なし　/　null = 削除のみ　/　AttachImageInput = 添付・差し替え
//
// Phase2で複数添付にする場合は AttachImageInput[] | null | undefined へ拡張、
// Album機能を作る場合は AttachImageInput に imageId を追加するだけで対応できる想定。
export type ImageInput = AttachImageInput | null | undefined;