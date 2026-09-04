import { z } from "zod";

// @@unique([userId, name]) が前後空白違いを別名として扱ってしまわないよう、
// ここでtrimしてからDB制約に委ねる。永続化直前でもService側でtrimし、
// APIを経由しない呼び出し経路でも一貫性を保つ（両者は二重防御であり片方だけで十分とはしない）。
export const createAlbumSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "アルバム名を入力してください")
    .max(50, "アルバム名は50文字以内で入力してください"),
});

export const updateAlbumSchema = createAlbumSchema;

export type CreateAlbumSchemaInput = z.infer<typeof createAlbumSchema>;
export type UpdateAlbumSchemaInput = z.infer<typeof updateAlbumSchema>;

// Todo作成・編集時にAlbum選択欄から送られるalbumId。
// null = 「未所属のまま保存」を表す。
// Default Albumを前提とせず、Album未所属のTodoを許可する。
// trim()はAlbum名側のバリデーション方針と統一するため（空白のみの値を弾く）。
export const albumIdInputSchema = z.string().trim().min(1).nullable();
export type AlbumIdInput = z.infer<typeof albumIdInputSchema>;

// Album内画像の並び替え。DnD確定時に「並び替え後の imageId 全量」をスナップショットとして送る
// （Todoの ImageListInput と同じ設計。差分ではなく最終状態を渡す）。
// 所有権チェック・Album所属チェック（送られたidが本当にこのAlbum配下か）はDB状態に依存するため
// ここでは行わず、Service層（CLAUDE.md「Service層の責務」）に委ねる。
export const reorderAlbumImagesSchema = z.object({
  imageIds: z
    .array(z.string().trim().min(1))
    .min(1, "画像が指定されていません")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "画像IDが重複しています",
    }),
});

export type ReorderAlbumImagesInput = z.infer<typeof reorderAlbumImagesSchema>;