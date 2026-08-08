import { describe, it, expect } from "vitest";
import {
  toTodoImageSummary,
  toTodoWithImageSummaries,
} from "@/features/todos/lib/todoImageMapper";
import type { Todo, TodoImageDto } from "@/features/todos/types";

describe("todoImageMapper", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");

  // TodoImageDto = Image(Prisma) & { order: number }。
  // storageKey/userId/albumId/createdAt/updatedAtは、変換後の出力に
  // 含まれてはいけないフィールドとして意図的に含めている
  // （このファイルの存在意義そのものがstorageKey漏洩防止のため）。
  const baseImage: TodoImageDto = {
    id: "clximg1",
    userId: "clxuser1",
    albumId: "clxalbum1",
    storageKey: "uploads/11111111-1111-1111-1111-111111111111.jpg",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 12345,
    createdAt: now,
    updatedAt: now,
    order: 0,
  };

  const baseTodo: Todo = {
    id: "clxtodo1",
    todo_title: "テストタスク",
    priority: "HIGH",
    progress: 50,
    userId: "clxuser1",
    createdAt: now,
    updatedAt: now,
  };

  describe("toTodoImageSummary", () => {
    it("許可された5フィールド（id/originalFileName/mimeType/fileSize/order）のみを返すこと", () => {
      const result = toTodoImageSummary(baseImage);

      expect(result).toEqual({
        id: "clximg1",
        originalFileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize: 12345,
        order: 0,
      });
    });

    it("storageKeyを出力に含まないこと（漏洩防止の中核）", () => {
      const result = toTodoImageSummary(baseImage);

      expect(result).not.toHaveProperty("storageKey");
    });

    it("userId / albumId / createdAt / updatedAtを出力に含まないこと", () => {
      const result = toTodoImageSummary(baseImage);

      expect(result).not.toHaveProperty("userId");
      expect(result).not.toHaveProperty("albumId");
      expect(result).not.toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("updatedAt");
    });

    it("orderが0件目でも欠落せずそのまま返ること", () => {
      const result = toTodoImageSummary({ ...baseImage, order: 0 });

      expect(result.order).toBe(0);
    });
  });

  describe("toTodoWithImageSummaries", () => {
    it("Todo本体のフィールドをそのまま保持すること", () => {
      const result = toTodoWithImageSummaries({ ...baseTodo, images: [baseImage] });

      expect(result).toMatchObject({
        id: "clxtodo1",
        todo_title: "テストタスク",
        priority: "HIGH",
        progress: 50,
        userId: "clxuser1",
        createdAt: now,
        updatedAt: now,
      });
    });

    it("imagesを TodoImageSummary[] に変換すること", () => {
      const result = toTodoWithImageSummaries({ ...baseTodo, images: [baseImage] });

      expect(result.images).toEqual([
        {
          id: "clximg1",
          originalFileName: "photo.jpg",
          mimeType: "image/jpeg",
          fileSize: 12345,
          order: 0,
        },
      ]);
    });

    it("imagesの各要素にstorageKeyが含まれないこと（漏洩防止のend-to-end確認）", () => {
      const result = toTodoWithImageSummaries({ ...baseTodo, images: [baseImage] });

      result.images.forEach((img) => {
        expect(img).not.toHaveProperty("storageKey");
      });
    });

    it("images が空配列の場合、空配列のまま返すこと", () => {
      const result = toTodoWithImageSummaries({ ...baseTodo, images: [] });

      expect(result.images).toEqual([]);
    });

    it("複数画像がある場合、order順を保ったまま全件変換すること", () => {
      const images: TodoImageDto[] = [
        { ...baseImage, id: "clximg1", order: 0 },
        { ...baseImage, id: "clximg2", order: 1 },
      ];

      const result = toTodoWithImageSummaries({ ...baseTodo, images });

      expect(result.images.map((img) => img.id)).toEqual(["clximg1", "clximg2"]);
      expect(result.images.map((img) => img.order)).toEqual([0, 1]);
    });
  });
});