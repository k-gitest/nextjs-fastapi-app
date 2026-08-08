/**
 * GraphQL API実装（サービス層）
 *
 * services/index.ts のスイッチ層からREST版(imageService.ts)と
 * 透過的に入れ替わるため、公開シグネチャ（引数の型・順序・戻り値の型）は
 * REST版と一致させること。
 *
 * エラー変換について:
 * gqlRequest/gqlMutation は内部でGraphQLエラー・error union結果の両方を
 * ApiError（lib/graphql-client.ts）に正規化してthrowする。そのため、この層に
 * 届いた時点で result.__typename を見て分岐することはできない。
 * REST版と同じ例外型（NotFoundError/ValidationError）をRoute Handlerに渡すため、
 * ApiError.status を見て変換し直す。
 */
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
import { ApiError } from "@/errors/api-error";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { GET_UNASSIGNED_IMAGES } from "@/graphql/modules/images/queries";
import { DELETE_IMAGE, UPDATE_IMAGE_ALBUM } from "@/graphql/modules/images/mutations";
import type { ImageSummary } from "../types";

// ===== GraphQL レスポンス型 =====

interface GqlImage {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  usageCount: number;
}

interface GetUnassignedImagesQuery {
  unassignedImages: GqlImage[];
}

// gqlMutationがエラーunionを先にthrowするため、成功ペイロード型のみ想定すればよい
interface DeleteImageMutation {
  deleteImage: { __typename: "DeleteImagePayload"; success: boolean };
}

interface UpdateImageAlbumMutation {
  updateImageAlbum: { __typename: "UpdateImageAlbumPayload"; image: GqlImage };
}

// ===== 型変換 =====

function gqlToImageSummary(gql: GqlImage): ImageSummary {
  return {
    id: gql.id,
    originalFileName: gql.originalFileName,
    mimeType: gql.mimeType,
    fileSize: gql.fileSize,
    createdAt: new Date(gql.createdAt),
    usageCount: gql.usageCount,
  };
}

// ApiErrorをREST版と同じドメイン例外に変換し直す。
// マッチしないstatus（401/403/500等）はApiErrorのままthrowし、
// Route Handler側のグローバルハンドリングに委ねる。
function rethrowAsDomainError(e: unknown): never {
  if (e instanceof ApiError) {
    if (e.isNotFoundError) throw new NotFoundError(e.message);
    if (e.isValidationError) throw new ValidationError(e.message);
  }
  throw e;
}

// ===== GraphQL サービス実装 =====

export const imageServiceGraphQL = {
  // userIdはGraphQL側ではcontext.userから解決されるため未使用。
  // REST版(imageService.getUnassignedImages(userId))とシグネチャを揃えるために引数として受け取る。
  getUnassignedImages: async (_userId: string): Promise<ImageSummary[]> => {
    const data = await gqlRequest<GetUnassignedImagesQuery>(GET_UNASSIGNED_IMAGES);
    return data.unassignedImages.map(gqlToImageSummary);
  },

  // userIdはREST版のシグネチャ互換のために受け取る（未使用）。
  deleteImage: async (
    id: string,
    _userId: string,
    context: { correlationId: string },
  ): Promise<void> => {
    try {
      await gqlMutation<DeleteImageMutation, "deleteImage">(
        DELETE_IMAGE,
        { id, correlationId: context.correlationId },
        "deleteImage",
      );
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  // userIdはREST版のシグネチャ互換のために受け取る（未使用）。
  updateImageAlbum: async (
    id: string,
    albumId: string | null,
    _userId: string,
  ): Promise<ImageSummary> => {
    try {
      const result = await gqlMutation<UpdateImageAlbumMutation, "updateImageAlbum">(
        UPDATE_IMAGE_ALBUM,
        { id, albumId },
        "updateImageAlbum",
      );
      return gqlToImageSummary(result.image);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },
};