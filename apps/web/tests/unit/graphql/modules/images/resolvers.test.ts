import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  imageQueryResolvers,
  imageMutationResolvers,
} from "@/graphql/modules/images/resolvers";
import type { GraphQLContext } from "@/graphql/context";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";

vi.mock("@/features/images/services/imageService", () => ({
  deleteImage: vi.fn(),
  updateImageAlbum: vi.fn(),
  getUnassignedImages: vi.fn(),
}));

import {
  deleteImage,
  updateImageAlbum,
  getUnassignedImages,
} from "@/features/images/services/imageService";

const mockUser = {
  id: "clx1234",
  email: "test@example.com",
  name: "テストユーザー",
};

const now = new Date("2024-01-01T00:00:00.000Z");

const mockImage = {
  id: "clximg1",
  originalFileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSize: 12345,
  createdAt: now,
  usageCount: 2,
};

const authenticatedContext: GraphQLContext = {
  user: mockUser,
  prisma: {} as never,
  cookieHeader: "session=xxx",
};

const unauthenticatedContext: GraphQLContext = {
  user: null,
  prisma: {} as never,
  cookieHeader: null,
};

describe("imageQueryResolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unassignedImages", () => {
    it("認証済みユーザーの未所属画像一覧を返す", async () => {
      vi.mocked(getUnassignedImages).mockResolvedValueOnce([mockImage]);

      const result = await imageQueryResolvers.unassignedImages(
        {},
        {},
        authenticatedContext,
      );

      expect(getUnassignedImages).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "clximg1", usageCount: 2 });
    });

    it("createdAt がISO文字列に変換される", async () => {
      vi.mocked(getUnassignedImages).mockResolvedValueOnce([mockImage]);

      const result = await imageQueryResolvers.unassignedImages(
        {},
        {},
        authenticatedContext,
      );

      expect(typeof result[0].createdAt).toBe("string");
    });

    it("未認証の場合はGraphQLErrorをthrowする", async () => {
      await expect(
        imageQueryResolvers.unassignedImages({}, {}, unauthenticatedContext),
      ).rejects.toThrow();
    });
  });
});

describe("imageMutationResolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteImage", () => {
    it("Image削除成功時はDeleteImagePayload(success: true)を返す", async () => {
      vi.mocked(deleteImage).mockResolvedValueOnce(undefined);

      const result = await imageMutationResolvers.deleteImage(
        {},
        { id: "clximg1", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("DeleteImagePayload");
      if (result.__typename === "DeleteImagePayload") {
        expect(result.success).toBe(true);
      }
    });

    it("correlationIdがサービス層に渡される", async () => {
      vi.mocked(deleteImage).mockResolvedValueOnce(undefined);

      await imageMutationResolvers.deleteImage(
        {},
        { id: "clximg1", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(deleteImage).toHaveBeenCalledWith("clximg1", mockUser.id, {
        correlationId: "test-correlation-id",
      });
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await imageMutationResolvers.deleteImage(
        {},
        { id: "clximg1", correlationId: "test-correlation-id" },
        unauthenticatedContext,
      );

      expect(result.__typename).toBe("AuthenticationError");
    });

    it("NotFoundErrorの場合はNotFoundErrorを返す", async () => {
      vi.mocked(deleteImage).mockRejectedValueOnce(
        new NotFoundError("Image not found or unauthorized"),
      );

      const result = await imageMutationResolvers.deleteImage(
        {},
        { id: "clx9999", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("NotFoundError");
    });

    it("その他のエラーはInternalErrorを返す", async () => {
      vi.mocked(deleteImage).mockRejectedValueOnce(new Error("DB error"));

      const result = await imageMutationResolvers.deleteImage(
        {},
        { id: "clximg1", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("InternalError");
    });
  });

  describe("updateImageAlbum", () => {
    it("Album変更成功時はUpdateImageAlbumPayloadを返す", async () => {
      vi.mocked(updateImageAlbum).mockResolvedValueOnce(mockImage);

      const result = await imageMutationResolvers.updateImageAlbum(
        {},
        { id: "clximg1", albumId: "clxalbum1" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("UpdateImageAlbumPayload");
      if (result.__typename === "UpdateImageAlbumPayload") {
        expect(result.image).toMatchObject({ id: "clximg1", usageCount: 2 });
      }
    });

    it("albumId: nullが未所属化としてサービス層に渡される", async () => {
      vi.mocked(updateImageAlbum).mockResolvedValueOnce(mockImage);

      await imageMutationResolvers.updateImageAlbum(
        {},
        { id: "clximg1", albumId: null },
        authenticatedContext,
      );

      expect(updateImageAlbum).toHaveBeenCalledWith("clximg1", null, mockUser.id);
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await imageMutationResolvers.updateImageAlbum(
        {},
        { id: "clximg1", albumId: "clxalbum1" },
        unauthenticatedContext,
      );

      expect(result.__typename).toBe("AuthenticationError");
    });

    it("NotFoundErrorの場合はNotFoundErrorを返す", async () => {
      vi.mocked(updateImageAlbum).mockRejectedValueOnce(
        new NotFoundError("Image not found or unauthorized"),
      );

      const result = await imageMutationResolvers.updateImageAlbum(
        {},
        { id: "clx9999", albumId: "clxalbum1" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("NotFoundError");
    });

    it("ValidationErrorの場合はValidationErrorを返す", async () => {
      vi.mocked(updateImageAlbum).mockRejectedValueOnce(
        new ValidationError("不正なアルバムが指定されました"),
      );

      const result = await imageMutationResolvers.updateImageAlbum(
        {},
        { id: "clximg1", albumId: "clxbad" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("ValidationError");
    });

    it("その他のエラーはInternalErrorを返す", async () => {
      vi.mocked(updateImageAlbum).mockRejectedValueOnce(new Error("DB error"));

      const result = await imageMutationResolvers.updateImageAlbum(
        {},
        { id: "clximg1", albumId: "clxalbum1" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("InternalError");
    });
  });
});