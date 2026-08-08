import { describe, it, expect, vi, beforeEach } from "vitest";
import { imageServiceGraphQL } from "@/features/images/services/imageServiceGraphQL";
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
import { ApiError } from "@/errors/api-error";
import { ValidationError } from "@/errors/validation-error";
import { NotFoundError } from "@/errors/not-found-error";

vi.mock("@/lib/graphql-client", () => ({
  gqlRequest: vi.fn(),
  gqlMutation: vi.fn(),
}));

// gqlMutation は複数の異なる戻り値型を持つオーバーロードのため
// vi.mocked だと never 型になる。ReturnType<typeof vi.fn> でキャストして回避する
const mockedGqlMutation = gqlMutation as ReturnType<typeof vi.fn>;
const mockedGqlRequest = gqlRequest as ReturnType<typeof vi.fn>;

describe("imageServiceGraphQL", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");

  const baseGqlImage = {
    id: "clximg1",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 12345,
    createdAt: now.toISOString(),
    usageCount: 2,
  };

  const expectedImage = {
    id: "clximg1",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 12345,
    createdAt: now,
    usageCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== getUnassignedImages =====

  describe("getUnassignedImages", () => {
    it("GqlImage の camelCase フィールドが ImageSummary に変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({ unassignedImages: [baseGqlImage] });

      const result = await imageServiceGraphQL.getUnassignedImages("user1");

      expect(result).toEqual([expectedImage]);
    });

    it("createdAt が Date オブジェクトに変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({ unassignedImages: [baseGqlImage] });

      const result = await imageServiceGraphQL.getUnassignedImages("user1");

      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it("空配列が返ってきた場合、空配列をそのまま返すこと", async () => {
      mockedGqlRequest.mockResolvedValue({ unassignedImages: [] });

      const result = await imageServiceGraphQL.getUnassignedImages("user1");

      expect(result).toEqual([]);
    });
  });

  // ===== deleteImage =====

  describe("deleteImage", () => {
    it("DeleteImagePayload が返った場合、voidで解決すること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "DeleteImagePayload",
        success: true,
      });

      await expect(
        imageServiceGraphQL.deleteImage("clximg1", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).resolves.toBeUndefined();
    });

    it("id と correlationId がミューテーション変数として渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "DeleteImagePayload",
        success: true,
      });

      await imageServiceGraphQL.deleteImage("clximg1", "user1", {
        correlationId: "test-correlation-id",
      });

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        { id: "clximg1", correlationId: "test-correlation-id" },
        "deleteImage",
      );
    });

    it("NotFoundError(404) が返った場合、NotFoundErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(404, "Image not found or unauthorized"));

      await expect(
        imageServiceGraphQL.deleteImage("clx9999", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow(NotFoundError);
      await expect(
        imageServiceGraphQL.deleteImage("clx9999", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow("Image not found or unauthorized");
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(500, "Internal server error"));

      await expect(
        imageServiceGraphQL.deleteImage("clximg1", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow(ApiError);
      await expect(
        imageServiceGraphQL.deleteImage("clximg1", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow("Internal server error");
    });
  });

  // ===== updateImageAlbum =====

  describe("updateImageAlbum", () => {
    it("UpdateImageAlbumPayload が返った場合、変換済みの ImageSummary を返すこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateImageAlbumPayload",
        image: baseGqlImage,
      });

      const result = await imageServiceGraphQL.updateImageAlbum(
        "clximg1",
        "clxalbum1",
        "user1",
      );

      expect(result).toEqual(expectedImage);
    });

    it("albumId がミューテーション変数としてそのまま渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateImageAlbumPayload",
        image: baseGqlImage,
      });

      await imageServiceGraphQL.updateImageAlbum("clximg1", "clxalbum1", "user1");

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        { id: "clximg1", albumId: "clxalbum1" },
        "updateImageAlbum",
      );
    });

    it("albumId が null（未所属化）の場合、null がそのまま渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateImageAlbumPayload",
        image: baseGqlImage,
      });

      await imageServiceGraphQL.updateImageAlbum("clximg1", null, "user1");

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        { id: "clximg1", albumId: null },
        "updateImageAlbum",
      );
    });

    it("NotFoundError(404) が返った場合、NotFoundErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(404, "Image not found or unauthorized"));

      await expect(
        imageServiceGraphQL.updateImageAlbum("clx9999", "clxalbum1", "user1"),
      ).rejects.toThrow(NotFoundError);
      await expect(
        imageServiceGraphQL.updateImageAlbum("clx9999", "clxalbum1", "user1"),
      ).rejects.toThrow("Image not found or unauthorized");
    });

    it("ValidationError(400) が返った場合、ValidationErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(400, "不正なアルバムが指定されました"));

      await expect(
        imageServiceGraphQL.updateImageAlbum("clximg1", "clxbad", "user1"),
      ).rejects.toThrow(ValidationError);
      await expect(
        imageServiceGraphQL.updateImageAlbum("clximg1", "clxbad", "user1"),
      ).rejects.toThrow("不正なアルバムが指定されました");
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(500, "server error"));

      await expect(
        imageServiceGraphQL.updateImageAlbum("clximg1", "clxalbum1", "user1"),
      ).rejects.toThrow(ApiError);
      await expect(
        imageServiceGraphQL.updateImageAlbum("clximg1", "clxalbum1", "user1"),
      ).rejects.toThrow("server error");
    });
  });
});