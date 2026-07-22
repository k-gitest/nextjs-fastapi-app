import { z } from "zod";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB（1枚あたり）

// Phase2（複数添付）の暫定値。UI設計・運用実績を見て将来調整する前提の設定値なので、
// マジックナンバーとしてコード中に散らばらせず、必ずこの定数経由で参照すること。
export const MAX_IMAGES_PER_TODO = 20;
export const MAX_TOTAL_IMAGE_SIZE_BYTES = 30 * 1024 * 1024; // 30MB（合計）

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

// Phase1の単数添付専用型。
// TODO(Phase2完了後): ImageUploader等の単数添付UIを複数添付UIへ置き換えたら、
// この型と、これを参照している単数専用コンポーネントごと削除する。
// undefined = 変更なし　/　null = 削除のみ　/　AttachImageInput = 添付・差し替え
export type ImageInput = AttachImageInput | null | undefined;

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
// 信用せず、必ずサーバー側（applyImageChange）でImage.userIdを直接検証すること。

export const imageListInputSchema = z.array(z.string().min(1)).max(MAX_IMAGES_PER_TODO);
export type ImageListInput = z.infer<typeof imageListInputSchema> | undefined;

// Image単体作成API（POST /api/images）専用の入力スキーマ
export const createImageInputSchema = z.object({
  storageKey: z.string().min(1),
  originalFileName: originalFileNameSchema,
  mimeType: mimeTypeSchema,
  fileSize: z.number().int().positive().max(MAX_IMAGE_FILE_SIZE_BYTES),
});
export type CreateImageInput = z.infer<typeof createImageInputSchema>;