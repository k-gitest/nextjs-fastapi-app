import { describe, it, expect } from "vitest";
import {
  toTodoImageSummary,
  toTodoWithImageSummaries,
} from "@/features/todos/lib/todoImageMapper";
import type { TodoImageDto, TodoWithImages } from "@/features/todos/types";

describe("todoImageMapper", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");

  // TodoImageDtoは既にPrisma非依存の明示的interface（id/originalFileName/
  // mimeType/fileSize/orderの5フィールドのみ）。Prisma Image由来の
  // 余分なフィールド（storageKey等）を落とす検証は、その境界を実際に
  // 持つtodoService.getTodos()側のテストで行う（todoService.test.ts参照）。
  // ここではTodoImageDto契約内での変換が正しく行われることのみを検証する。
  const baseImage: TodoImageDto = {
    id: "clximg1",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 12345,
    order: 0,
  };

  const baseTodo: TodoWithImages = {
    id: "clxtodo1",
    todo_title: "テストタスク",
    priority: "HIGH",
    progress: 50,
    userId: "clxuser1",
    createdAt: now,
    updatedAt: now,
    images: [],
  };

  describe("toTodoImageSummary", () => {
    it("TodoImageDtoの5フィールドをそのまま返すこと", () => {
      const result = toTodoImageSummary(baseImage);

      expect(result).toEqual(baseImage);
    });
  });

  describe("toTodoWithImageSummaries", () => {
    it("Todo本体のうち公開DTOに含まれるフィールドのみを保持すること", () => {
      const result = toTodoWithImageSummaries({ ...baseTodo, images: [baseImage] });

      expect(result).toMatchObject({
        id: "clxtodo1",
        todo_title: "テストタスク",
        priority: "HIGH",
        progress: 50,
        updatedAt: now,
      });
    });

    it("Todo本体からuserId / createdAtを除外すること（Issue #27: RESTレスポンスへの漏洩防止）", () => {
      const result = toTodoWithImageSummaries({ ...baseTodo, images: [baseImage] });

      expect(result).not.toHaveProperty("userId");
      expect(result).not.toHaveProperty("createdAt");
    });

    it("imagesをそのまま変換すること", () => {
      const result = toTodoWithImageSummaries({ ...baseTodo, images: [baseImage] });

      expect(result.images).toEqual([baseImage]);
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