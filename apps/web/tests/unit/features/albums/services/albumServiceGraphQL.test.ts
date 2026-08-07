import { describe, it, expect, vi, beforeEach } from "vitest";
import { albumServiceGraphQL } from "@/features/albums/services/albumServiceGraphQL";
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
import { ApiError } from "@/errors/api-error";
import { ValidationError } from "@/errors/validation-error";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";

vi.mock("@/lib/graphql-client", () => ({
  gqlRequest: vi.fn(),
  gqlMutation: vi.fn(),
}));

// gqlMutation は複数の異なる戻り値型を持つオーバーロードのため
// vi.mocked だと never 型になる。ReturnType<typeof vi.fn> でキャストして回避する
const mockedGqlMutation = gqlMutation as ReturnType<typeof vi.fn>;
const mockedGqlRequest = gqlRequest as ReturnType<typeof vi.fn>;

describe("albumServiceGraphQL", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");

  const baseGqlAlbum = {
    id: "clxalbum1",
    name: "テストアルバム",
    userId: "user1",
    displayOrder: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const expectedAlbum = {
    id: "clxalbum1",
    name: "テストアルバム",
    userId: "user1",
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  const baseGqlAlbumImage = {
    id: "clximg1",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 12345,
    createdAt: now.toISOString(),
    usageCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== getAlbums =====

  describe("getAlbums", () => {
    it("GqlAlbum の camelCase フィールドが Album に変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({ albums: [baseGqlAlbum] });

      const result = await albumServiceGraphQL.getAlbums("user1");

      expect(result).toEqual([expectedAlbum]);
    });

    it("createdAt / updatedAt が Date オブジェクトに変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({ albums: [baseGqlAlbum] });

      const result = await albumServiceGraphQL.getAlbums("user1");

      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
    });

    it("空配列が返ってきた場合、空配列をそのまま返すこと", async () => {
      mockedGqlRequest.mockResolvedValue({ albums: [] });

      const result = await albumServiceGraphQL.getAlbums("user1");

      expect(result).toEqual([]);
    });
  });

  // ===== getAlbumDetail =====
  // album(id) は throw 方式（union ではない）のため、gqlRequest が
  // 成功時はデータを、失敗時は ApiError を直接 reject する契約になる。

  describe("getAlbumDetail", () => {
    it("成功時、images込みの AlbumDetail に変換されること", async () => {
      mockedGqlRequest.mockResolvedValue({
        album: { ...baseGqlAlbum, images: [baseGqlAlbumImage] },
      });

      const result = await albumServiceGraphQL.getAlbumDetail("clxalbum1", "user1");

      expect(result).toEqual({
        ...expectedAlbum,
        images: [
          {
            id: "clximg1",
            originalFileName: "photo.jpg",
            mimeType: "image/jpeg",
            fileSize: 12345,
            createdAt: now,
            usageCount: 2,
          },
        ],
      });
    });

    it("images が空配列の場合、空配列のまま返すこと", async () => {
      mockedGqlRequest.mockResolvedValue({
        album: { ...baseGqlAlbum, images: [] },
      });

      const result = await albumServiceGraphQL.getAlbumDetail("clxalbum1", "user1");

      expect(result.images).toEqual([]);
    });

    it("NotFoundError(404) が返った場合、NotFoundErrorとしてスローすること", async () => {
      mockedGqlRequest.mockRejectedValue(new ApiError(404, "Album not found or unauthorized"));

      await expect(
        albumServiceGraphQL.getAlbumDetail("clx9999", "user1"),
      ).rejects.toThrow(NotFoundError);
      await expect(
        albumServiceGraphQL.getAlbumDetail("clx9999", "user1"),
      ).rejects.toThrow("Album not found or unauthorized");
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlRequest.mockRejectedValue(new ApiError(500, "Internal server error"));

      await expect(
        albumServiceGraphQL.getAlbumDetail("clxalbum1", "user1"),
      ).rejects.toThrow(ApiError);
      await expect(
        albumServiceGraphQL.getAlbumDetail("clxalbum1", "user1"),
      ).rejects.toThrow("Internal server error");
    });
  });

  // ===== createAlbum =====

  describe("createAlbum", () => {
    const input = { name: "新しいアルバム", userId: "user1" };

    it("CreateAlbumPayload が返った場合、変換済みの Album を返すこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "CreateAlbumPayload",
        album: { ...baseGqlAlbum, name: "新しいアルバム" },
      });

      const result = await albumServiceGraphQL.createAlbum(input);

      expect(result.name).toBe("新しいアルバム");
    });

    it("name がミューテーションの input にそのまま渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "CreateAlbumPayload",
        album: baseGqlAlbum,
      });

      await albumServiceGraphQL.createAlbum(input);

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        { input: { name: "新しいアルバム" } },
        "createAlbum",
      );
    });

    it("ValidationError(400) が返った場合、ValidationErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(400, "アルバム名を入力してください"));

      await expect(albumServiceGraphQL.createAlbum(input)).rejects.toThrow(ValidationError);
      await expect(albumServiceGraphQL.createAlbum(input)).rejects.toThrow(
        "アルバム名を入力してください",
      );
    });

    it("ConflictError(409) が返った場合、ConflictErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(409, "同名のアルバムが既に存在します"));

      await expect(albumServiceGraphQL.createAlbum(input)).rejects.toThrow(ConflictError);
      await expect(albumServiceGraphQL.createAlbum(input)).rejects.toThrow(
        "同名のアルバムが既に存在します",
      );
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(500, "Internal server error"));

      await expect(albumServiceGraphQL.createAlbum(input)).rejects.toThrow(ApiError);
      await expect(albumServiceGraphQL.createAlbum(input)).rejects.toThrow(
        "Internal server error",
      );
    });
  });

  // ===== updateAlbum =====

  describe("updateAlbum", () => {
    it("UpdateAlbumPayload が返った場合、変換済みの Album を返すこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateAlbumPayload",
        album: { ...baseGqlAlbum, name: "更新済み" },
      });

      const result = await albumServiceGraphQL.updateAlbum(
        { id: "clxalbum1", name: "更新済み" },
        "user1",
      );

      expect(result.name).toBe("更新済み");
    });

    it("id はミューテーションの input に含まれず、トップレベルの引数として渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "UpdateAlbumPayload",
        album: baseGqlAlbum,
      });

      await albumServiceGraphQL.updateAlbum({ id: "clxalbum1", name: "更新済み" }, "user1");

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        { id: "clxalbum1", input: { name: "更新済み" } },
        "updateAlbum",
      );
    });

    it("NotFoundError(404) が返った場合、NotFoundErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(404, "Album not found or unauthorized"));

      await expect(
        albumServiceGraphQL.updateAlbum({ id: "clx9999", name: "更新" }, "user1"),
      ).rejects.toThrow(NotFoundError);
      await expect(
        albumServiceGraphQL.updateAlbum({ id: "clx9999", name: "更新" }, "user1"),
      ).rejects.toThrow("Album not found or unauthorized");
    });

    it("ConflictError(409) が返った場合、ConflictErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(409, "同名のアルバムが既に存在します"));

      await expect(
        albumServiceGraphQL.updateAlbum({ id: "clxalbum1", name: "重複名" }, "user1"),
      ).rejects.toThrow(ConflictError);
      await expect(
        albumServiceGraphQL.updateAlbum({ id: "clxalbum1", name: "重複名" }, "user1"),
      ).rejects.toThrow("同名のアルバムが既に存在します");
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(500, "server error"));

      await expect(
        albumServiceGraphQL.updateAlbum({ id: "clxalbum1", name: "更新" }, "user1"),
      ).rejects.toThrow(ApiError);
      await expect(
        albumServiceGraphQL.updateAlbum({ id: "clxalbum1", name: "更新" }, "user1"),
      ).rejects.toThrow("server error");
    });
  });

  // ===== deleteAlbum =====

  describe("deleteAlbum", () => {
    it("DeleteAlbumPayload が返った場合、削除された Album 全体を返すこと", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "DeleteAlbumPayload",
        album: baseGqlAlbum,
        deletedId: "clxalbum1",
        message: "Albumを削除しました",
      });

      const result = await albumServiceGraphQL.deleteAlbum("clxalbum1", "user1", {
        correlationId: "test-correlation-id",
      });

      expect(result).toEqual(expectedAlbum);
    });

    it("correlationId がミューテーション変数として渡されること", async () => {
      mockedGqlMutation.mockResolvedValue({
        __typename: "DeleteAlbumPayload",
        album: baseGqlAlbum,
        deletedId: "clxalbum1",
        message: "Albumを削除しました",
      });

      await albumServiceGraphQL.deleteAlbum("clxalbum1", "user1", {
        correlationId: "test-correlation-id",
      });

      expect(mockedGqlMutation).toHaveBeenCalledWith(
        expect.anything(),
        { id: "clxalbum1", correlationId: "test-correlation-id" },
        "deleteAlbum",
      );
    });

    it("NotFoundError(404) が返った場合、NotFoundErrorとしてスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(404, "Album not found or unauthorized"));

      await expect(
        albumServiceGraphQL.deleteAlbum("clx9999", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow(NotFoundError);
      await expect(
        albumServiceGraphQL.deleteAlbum("clx9999", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow("Album not found or unauthorized");
    });

    it("InternalError(500) が返った場合、ApiErrorのままスローすること", async () => {
      mockedGqlMutation.mockRejectedValue(new ApiError(500, "server error"));

      await expect(
        albumServiceGraphQL.deleteAlbum("clxalbum1", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow(ApiError);
      await expect(
        albumServiceGraphQL.deleteAlbum("clxalbum1", "user1", {
          correlationId: "test-correlation-id",
        }),
      ).rejects.toThrow("server error");
    });
  });
});