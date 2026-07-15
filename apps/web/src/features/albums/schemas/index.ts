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