/**
 * Image GraphQL リゾルバー（サーバー側）
 *
 * 責務:
 * - 認証チェック
 * - 引数を受け取り既存imageServiceを呼ぶ
 * - GraphQL型への変換
 *
 * ビジネスロジックは features/images/services/imageService.ts に委譲
 */
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../context";
import {
  deleteImage,
  updateImageAlbum,
  getUnassignedImages,
} from "@/features/images/services/imageService";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";
import type { ImageSummary } from "@/features/images/types";

// ===== 型変換ヘルパー =====

function toGraphQLImage(image: ImageSummary) {
  return {
    id: image.id,
    originalFileName: image.originalFileName,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    createdAt: image.createdAt.toISOString(),
    usageCount: image.usageCount,
  };
}

// Mutation用（エラーオブジェクトをreturn）
function requireAuth(context: GraphQLContext) {
  if (!context.user) {
    return {
      __typename: "AuthenticationError" as const,
      category: "AUTHENTICATION",
      message: "認証が必要です",
      code: "authentication_error",
    };
  }
  return null;
}

// Query用（throwする）
function requireAuthForQuery(context: GraphQLContext) {
  if (!context.user) {
    throw new GraphQLError("認証が必要です", {
      extensions: {
        __typename: "AuthenticationError",
        code: "authentication_error",
        category: "AUTHENTICATION",
      },
    });
  }
}

// ===== Query リゾルバー =====

export const imageQueryResolvers = {
  unassignedImages: async (_: unknown, __: unknown, context: GraphQLContext) => {
    requireAuthForQuery(context);

    const images = await getUnassignedImages(context.user!.id);
    return images.map(toGraphQLImage);
  },
};

// ===== Mutation リゾルバー =====

export const imageMutationResolvers = {
  deleteImage: async (
    _: unknown,
    { id, correlationId }: { id: string; correlationId: string },
    context: GraphQLContext,
  ) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    try {
      await deleteImage(id, context.user!.id, { correlationId });
      return {
        __typename: "DeleteImagePayload" as const,
        success: true,
      };
    } catch (e) {
      if (e instanceof NotFoundError) {
        return {
          __typename: "NotFoundError" as const,
          category: "NOT_FOUND",
          message: e.message,
          code: "not_found",
        };
      }
      return {
        __typename: "InternalError" as const,
        category: "INTERNAL",
        message: "Image削除に失敗しました",
        code: "internal_error",
      };
    }
  },

  updateImageAlbum: async (
    _: unknown,
    { id, albumId }: { id: string; albumId: string | null },
    context: GraphQLContext,
  ) => {
    const authError = requireAuth(context);
    if (authError) return authError;

    try {
      const image = await updateImageAlbum(id, albumId, context.user!.id);
      return {
        __typename: "UpdateImageAlbumPayload" as const,
        image: toGraphQLImage(image),
      };
    } catch (e) {
      if (e instanceof NotFoundError) {
        return {
          __typename: "NotFoundError" as const,
          category: "NOT_FOUND",
          message: e.message,
          code: "not_found",
        };
      }
      if (e instanceof ValidationError) {
        return {
          __typename: "ValidationError" as const,
          category: "VALIDATION",
          message: e.message,
          code: "validation_error",
        };
      }
      return {
        __typename: "InternalError" as const,
        category: "INTERNAL",
        message: "Album変更に失敗しました",
        code: "internal_error",
      };
    }
  },
};