import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  albumQueryResolvers,
  albumMutationResolvers,
} from "@/graphql/modules/albums/resolvers";
import type { GraphQLContext } from "@/graphql/context";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import { ValidationError } from "@/errors/validation-error";

vi.mock("@/features/albums/services/albumService", () => ({
  albumService: {
    getAlbums: vi.fn(),
    getAlbumDetail: vi.fn(),
    createAlbum: vi.fn(),
    updateAlbum: vi.fn(),
    deleteAlbum: vi.fn(),
  },
}));

import { albumService } from "@/features/albums/services/albumService";

const mockUser = {
  id: "clx1234",
  email: "test@example.com",
  name: "テストユーザー",
};

const now = new Date("2024-01-01T00:00:00.000Z");

const mockAlbum = {
  id: "clxalbum1",
  name: "テストアルバム",
  userId: "clx1234",
  displayOrder: 0,
  createdAt: now,
  updatedAt: now,
};

const mockAlbumDetail = {
  ...mockAlbum,
  images: [
    {
      id: "clximg1",
      originalFileName: "photo.jpg",
      mimeType: "image/jpeg",
      fileSize: 12345,
      createdAt: now,
      usageCount: 2,
      albumDisplayOrder: 0,
    },
  ],
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

describe("albumQueryResolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("albums", () => {
    it("認証済みユーザーのAlbum一覧を返す", async () => {
      vi.mocked(albumService.getAlbums).mockResolvedValueOnce([mockAlbum]);

      const result = await albumQueryResolvers.albums({}, {}, authenticatedContext);

      expect(albumService.getAlbums).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "clxalbum1", name: "テストアルバム" });
    });

    it("未認証の場合はGraphQLErrorをthrowする", async () => {
      await expect(
        albumQueryResolvers.albums({}, {}, unauthenticatedContext),
      ).rejects.toThrow();
    });
  });

  describe("album", () => {
    it("Album詳細（images込み）を返す", async () => {
      vi.mocked(albumService.getAlbumDetail).mockResolvedValueOnce(mockAlbumDetail);

      const result = await albumQueryResolvers.album(
        {},
        { id: "clxalbum1" },
        authenticatedContext,
      );

      expect(albumService.getAlbumDetail).toHaveBeenCalledWith("clxalbum1", mockUser.id);
      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toMatchObject({
        id: "clximg1",
        originalFileName: "photo.jpg",
        usageCount: 2,
        albumDisplayOrder: 0,
      });
    });

    it("NotFoundErrorの場合、__typename: NotFoundError付きのGraphQLErrorをthrowする", async () => {
      vi.mocked(albumService.getAlbumDetail).mockRejectedValueOnce(
        new NotFoundError("Album not found or unauthorized"),
      );

      await expect(
        albumQueryResolvers.album({}, { id: "clx9999" }, authenticatedContext),
      ).rejects.toMatchObject({
        message: "Album not found or unauthorized",
        extensions: expect.objectContaining({ __typename: "NotFoundError" }),
      });
    });

    it("その他のエラーはそのままthrowされる（Yogaの500処理に委譲）", async () => {
      vi.mocked(albumService.getAlbumDetail).mockRejectedValueOnce(new Error("DB error"));

      await expect(
        albumQueryResolvers.album({}, { id: "clxalbum1" }, authenticatedContext),
      ).rejects.toThrow("DB error");
    });

    it("未認証の場合はGraphQLErrorをthrowする", async () => {
      await expect(
        albumQueryResolvers.album({}, { id: "clxalbum1" }, unauthenticatedContext),
      ).rejects.toThrow();
    });
  });
});

describe("albumMutationResolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAlbum", () => {
    it("Album作成成功時はCreateAlbumPayloadを返す", async () => {
      vi.mocked(albumService.createAlbum).mockResolvedValueOnce(mockAlbum);

      const result = await albumMutationResolvers.createAlbum(
        {},
        { input: { name: "テストアルバム" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("CreateAlbumPayload");
      if (result.__typename === "CreateAlbumPayload") {
        expect(result.album.name).toBe("テストアルバム");
      }
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await albumMutationResolvers.createAlbum(
        {},
        { input: { name: "テスト" } },
        unauthenticatedContext,
      );

      expect(result.__typename).toBe("AuthenticationError");
    });

    it("ConflictErrorの場合はConflictErrorを返す", async () => {
      vi.mocked(albumService.createAlbum).mockRejectedValueOnce(
        new ConflictError("同名のアルバムが既に存在します"),
      );

      const result = await albumMutationResolvers.createAlbum(
        {},
        { input: { name: "重複名" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("ConflictError");
    });

    it("ValidationErrorの場合はValidationErrorを返す", async () => {
      vi.mocked(albumService.createAlbum).mockRejectedValueOnce(
        new ValidationError("アルバム名を入力してください"),
      );

      const result = await albumMutationResolvers.createAlbum(
        {},
        { input: { name: "" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("ValidationError");
    });

    it("その他のエラーはInternalErrorを返す", async () => {
      vi.mocked(albumService.createAlbum).mockRejectedValueOnce(new Error("DB error"));

      const result = await albumMutationResolvers.createAlbum(
        {},
        { input: { name: "テスト" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("InternalError");
    });
  });

  describe("updateAlbum", () => {
    it("Album更新成功時はUpdateAlbumPayloadを返す", async () => {
      const updated = { ...mockAlbum, name: "更新済み" };
      vi.mocked(albumService.updateAlbum).mockResolvedValueOnce(updated);

      const result = await albumMutationResolvers.updateAlbum(
        {},
        { id: "clxalbum1", input: { name: "更新済み" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("UpdateAlbumPayload");
      if (result.__typename === "UpdateAlbumPayload") {
        expect(result.album.name).toBe("更新済み");
      }
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await albumMutationResolvers.updateAlbum(
        {},
        { id: "clxalbum1", input: { name: "更新" } },
        unauthenticatedContext,
      );

      expect(result.__typename).toBe("AuthenticationError");
    });

    it("NotFoundErrorの場合はNotFoundErrorを返す", async () => {
      vi.mocked(albumService.updateAlbum).mockRejectedValueOnce(
        new NotFoundError("Album not found or unauthorized"),
      );

      const result = await albumMutationResolvers.updateAlbum(
        {},
        { id: "clx9999", input: { name: "更新" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("NotFoundError");
    });

    it("ConflictErrorの場合はConflictErrorを返す", async () => {
      vi.mocked(albumService.updateAlbum).mockRejectedValueOnce(
        new ConflictError("同名のアルバムが既に存在します"),
      );

      const result = await albumMutationResolvers.updateAlbum(
        {},
        { id: "clxalbum1", input: { name: "重複名" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("ConflictError");
    });

    it("ValidationErrorの場合はValidationErrorを返す", async () => {
      vi.mocked(albumService.updateAlbum).mockRejectedValueOnce(
        new ValidationError("アルバム名を入力してください"),
      );

      const result = await albumMutationResolvers.updateAlbum(
        {},
        { id: "clxalbum1", input: { name: "" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("ValidationError");
    });

    it("その他のエラーはInternalErrorを返す", async () => {
      vi.mocked(albumService.updateAlbum).mockRejectedValueOnce(new Error("DB error"));

      const result = await albumMutationResolvers.updateAlbum(
        {},
        { id: "clxalbum1", input: { name: "更新" } },
        authenticatedContext,
      );

      expect(result.__typename).toBe("InternalError");
    });
  });

  describe("deleteAlbum", () => {
    it("Album削除成功時はDeleteAlbumPayloadを返す", async () => {
      vi.mocked(albumService.deleteAlbum).mockResolvedValueOnce(mockAlbum);

      const result = await albumMutationResolvers.deleteAlbum(
        {},
        { id: "clxalbum1", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("DeleteAlbumPayload");
      if (result.__typename === "DeleteAlbumPayload") {
        expect(result.deletedId).toBe("clxalbum1");
        expect(result.album).toMatchObject({ id: "clxalbum1" });
      }
    });

    it("correlationIdがサービス層に渡される", async () => {
      vi.mocked(albumService.deleteAlbum).mockResolvedValueOnce(mockAlbum);

      await albumMutationResolvers.deleteAlbum(
        {},
        { id: "clxalbum1", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(albumService.deleteAlbum).toHaveBeenCalledWith(
        "clxalbum1",
        mockUser.id,
        { correlationId: "test-correlation-id" },
      );
    });

    it("未認証の場合はAuthenticationErrorを返す", async () => {
      const result = await albumMutationResolvers.deleteAlbum(
        {},
        { id: "clxalbum1", correlationId: "test-correlation-id" },
        unauthenticatedContext,
      );

      expect(result.__typename).toBe("AuthenticationError");
    });

    it("NotFoundErrorの場合はNotFoundErrorを返す", async () => {
      vi.mocked(albumService.deleteAlbum).mockRejectedValueOnce(
        new NotFoundError("Album not found or unauthorized"),
      );

      const result = await albumMutationResolvers.deleteAlbum(
        {},
        { id: "clx9999", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("NotFoundError");
    });

    it("その他のエラーはInternalErrorを返す", async () => {
      vi.mocked(albumService.deleteAlbum).mockRejectedValueOnce(new Error("DB error"));

      const result = await albumMutationResolvers.deleteAlbum(
        {},
        { id: "clxalbum1", correlationId: "test-correlation-id" },
        authenticatedContext,
      );

      expect(result.__typename).toBe("InternalError");
    });
  });
});