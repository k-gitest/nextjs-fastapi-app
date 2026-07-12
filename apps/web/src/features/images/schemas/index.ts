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
// サーバー側（applyImageChange）は、この配列とDB上の現在のImage一覧を突き合わせて
// 差分（削除対象・追加対象・order変更）を逆算する。
//
//   undefined = 画像に関する変更なし（更新時のみ意味を持つ。作成時は常に配列を渡す想定）
//   配列      = 保存後の最終状態そのもの。配列のindexがそのままorderになる。
//               既存Imageのうち配列に含まれないものは削除される（空配列 = 全削除）。
//
// kind: "existing" の場合、その id が本当にリクエスト対象のTodoに属する画像かどうかは
// クライアントの申告を信用せず、必ずサーバー側（applyImageChange）で検証すること。
const imageSlotInputSchemaNew = z.object({ kind: z.literal("new"), data: attachImageInputSchema });
const imageSlotInputSchemaExisting = z.object({ kind: z.literal("existing"), id: z.string().min(1) });

export const imageSlotInputSchema = z.discriminatedUnion("kind", [
  imageSlotInputSchemaExisting,
  imageSlotInputSchemaNew,
]);
export type ImageSlotInput = z.infer<typeof imageSlotInputSchema>;

// PATCH /api/todos/[id] 用：既存画像の維持・新規追加の両方を許可する
export const imageListInputSchema = z.array(imageSlotInputSchema).max(MAX_IMAGES_PER_TODO);
export type ImageListInput = z.infer<typeof imageListInputSchema> | undefined;

// POST /api/todos 用：作成時点では existing という概念が存在しないため、
// API契約としてkind:"new"のみを許可する（Route側で型レベルに弾く）。
export const createImageListInputSchema = z.array(imageSlotInputSchemaNew).max(MAX_IMAGES_PER_TODO);
export type CreateImageListInput = z.infer<typeof createImageListInputSchema> | undefined;