import { z } from "zod";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB（1枚あたり）

export const MAX_IMAGES_PER_TODO = 20;
export const MAX_TOTAL_IMAGE_SIZE_BYTES = 30 * 1024 * 1024; // 30MB（合計）

const sanitizeOriginalFileName = (name: string): string => {
  const base = name.split(/[/\\]/).pop();
  return base && base.length > 0 ? base : name;
};

const originalFileNameSchema = z.string().min(1).max(255).transform(sanitizeOriginalFileName);

const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);

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

// ── Phase2: 複数添付 ──────────────────────────────────────────
//
// ImageListInput は「保存後の最終状態」をそのまま表すスナップショット型。
// PR3以降、Todo保存より前にImageは必ず作成済みになるため（B2 PUT → POST /api/images
// → Image作成という順序に変更）、Todo API境界では existing/new の区別が意味を持たなくなった。
// そのため単純な imageId の配列に統一する。配列のindexがそのままTodoImage.orderになる。
//
//   undefined = 画像に関する変更なし（更新時のみ意味を持つ。作成時は常に配列を渡す想定）
//   配列      = 保存後の最終状態そのもの。既存Imageのうち配列に含まれないものは
//               TodoImageの関連が外れる（空配列 = 全関連を解除。Image本体・B2は削除されない）。
//
// 配列内の各idが本当にリクエストしたユーザーの所有物かどうかは、クライアントの申告を
// 信用せず、必ずサーバー側（syncTodoImages）でImage.userIdを直接検証すること。

export const imageListInputSchema = z.array(z.string().min(1)).max(MAX_IMAGES_PER_TODO);
export type ImageListInput = z.infer<typeof imageListInputSchema> | undefined;

// storageKeyの許可形式: uploads/{uuid}.{extension}
// buildStorageKey() が生成する形式と一致させる。
//
// 拡張子の許可リストは他の画像検証処理とも重複している。
// 現時点では共通化せず、将来拡張子の追加・変更が頻発する場合に統合を検討する。
const STORAGE_KEY_PATTERN =
  /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/;

// Image単体作成API（POST /api/images）専用の入力スキーマ
export const createImageInputSchema = z.object({
  storageKey: z.string().regex(STORAGE_KEY_PATTERN, "不正な画像データです"),
  originalFileName: originalFileNameSchema,
  mimeType: mimeTypeSchema,
  fileSize: z.number().int().positive().max(MAX_IMAGE_FILE_SIZE_BYTES),
});
export type CreateImageInput = z.infer<typeof createImageInputSchema>;