import { describe, it, expect } from "vitest";
import { createImageInputSchema } from "@/features/images/schemas";

// createImageInputSchemaの必須フィールドのうち、storageKey検証と無関係な部分は
// 固定の有効値を使い回す。storageKeyだけを差し替えてテストする。
const baseValidInput = {
  originalFileName: "photo.jpg",
  mimeType: "image/jpeg" as const,
  fileSize: 1024,
};

const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("createImageInputSchema - storageKey", () => {
  describe("正常系", () => {
    it.each(["jpg", "png", "gif", "webp"])("uploads/{uuid}.%s を許可する", (ext) => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: `uploads/${VALID_UUID}.${ext}`,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("prefixが不正な場合は拒否する", () => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: `images/${VALID_UUID}.jpg`,
      });

      expect(result.success).toBe(false);
    });

    it("UUID形式が不正な場合は拒否する（桁不足）", () => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: "uploads/f47ac10b-58cc-4372-a567.jpg",
      });

      expect(result.success).toBe(false);
    });

    it("UUID形式が不正な場合は拒否する（ハイフン位置ずれ）", () => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: "uploads/f47ac10b58cc-4372-a567-0e02b2c3d479.jpg",
      });

      expect(result.success).toBe(false);
    });

    it("許可されていない拡張子の場合は拒否する", () => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: `uploads/${VALID_UUID}.jpeg`,
      });

      expect(result.success).toBe(false);
    });

    it("拡張子が大文字の場合は拒否する", () => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: `uploads/${VALID_UUID}.JPG`,
      });

      expect(result.success).toBe(false);
    });

    it("末尾に余計な文字列が付いている場合は拒否する", () => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: `uploads/${VALID_UUID}.png/extra`,
      });

      expect(result.success).toBe(false);
    });

    it("空文字の場合は拒否する", () => {
      const result = createImageInputSchema.safeParse({
        ...baseValidInput,
        storageKey: "",
      });

      expect(result.success).toBe(false);
    });
  });
});