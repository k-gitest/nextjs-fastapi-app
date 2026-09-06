/**
 * GraphQL API実装（サービス層）
 *
 * services/index.ts のスイッチ層からREST版(albumService.ts)と
 * 透過的に入れ替わるため、公開シグネチャ（引数の型・順序・戻り値の型）は
 * REST版と一致させること。
 *
 * エラー変換について:
 * gqlRequest/gqlMutation は内部でGraphQLエラー・error union結果の両方を
 * ApiError（lib/graphql-client.ts）に正規化してthrowする。そのため、この層に
 * 届いた時点で result.__typename を見て分岐することはできない
 * （エラー系unionが返ってきた時点でgqlMutationが先にthrow済みのため）。
 * REST版と同じ例外型（NotFoundError/ConflictError/ValidationError）を
 * Route Handlerに渡すため、ApiError.status を見て変換し直す。
 */
import { gqlRequest, gqlMutation } from "@/lib/graphql-client";
import { ApiError } from "@/errors/api-error";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import { ValidationError } from "@/errors/validation-error";
import { GET_ALBUMS, GET_ALBUM_DETAIL } from "@/graphql/modules/albums/queries";
import { CREATE_ALBUM, UPDATE_ALBUM, DELETE_ALBUM, REORDER_ALBUM_IMAGES } from "@/graphql/modules/albums/mutations";
import type { Album, AlbumDetail, CreateAlbumInput, UpdateAlbumInput } from "../types";

// ===== GraphQL レスポンス型 =====

interface GqlAlbum {
  id: string;
  name: string;
}

interface GqlAlbumImage {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  usageCount: number;
  albumDisplayOrder: number;
}

interface GetAlbumsQuery {
  albums: GqlAlbum[];
}

// album(id) は throw方式のため、成功時の型のみで良い
interface GetAlbumDetailQuery {
  album: GqlAlbum & { images: GqlAlbumImage[] };
}

// gqlMutationがエラーunionを先にthrowするため、成功ペイロード型のみ想定すればよい
interface CreateAlbumMutation {
  createAlbum: { __typename: "CreateAlbumPayload"; album: GqlAlbum };
}

interface UpdateAlbumMutation {
  updateAlbum: { __typename: "UpdateAlbumPayload"; album: GqlAlbum };
}

interface DeleteAlbumMutation {
  deleteAlbum: {
    __typename: "DeleteAlbumPayload";
    album: GqlAlbum;
    deletedId: string;
    message: string;
  };
}

interface ReorderAlbumImagesMutation {
  reorderAlbumImages: { __typename: "ReorderAlbumImagesPayload"; success: boolean };
}

// ===== 型変換 =====

// Service契約（Album）が既にid/nameのみのため、GraphQLレスポンスを
// そのまま返せる（以前はuserId/displayOrder/createdAt/updatedAtの
// 復元が必要だったが、Service契約の狭小化によりこの往復が不要になった）。
function gqlToAlbum(gql: GqlAlbum): Album {
  return {
    id: gql.id,
    name: gql.name,
  };
}

function gqlToAlbumDetail(gql: GqlAlbum & { images: GqlAlbumImage[] }): AlbumDetail {
  return {
    ...gqlToAlbum(gql),
    images: gql.images.map((image) => ({
      id: image.id,
      originalFileName: image.originalFileName,
      mimeType: image.mimeType,
      fileSize: image.fileSize,
      createdAt: new Date(image.createdAt),
      usageCount: image.usageCount,
      albumDisplayOrder: image.albumDisplayOrder,
    })),
  };
}

// ApiErrorをREST版と同じドメイン例外に変換し直す。
// マッチしないstatus（401/403/500等）はApiErrorのままthrowし、
// Route Handler側のグローバルハンドリングに委ねる。
function rethrowAsDomainError(e: unknown): never {
  if (e instanceof ApiError) {
    if (e.isNotFoundError) throw new NotFoundError(e.message);
    if (e.isConflictError) throw new ConflictError(e.message);
    if (e.isValidationError) throw new ValidationError(e.message);
  }
  throw e;
}

// ===== GraphQL サービス実装 =====

export const albumServiceGraphQL = {
  // userIdはGraphQL側ではcontext.userから解決されるため未使用。
  // REST版(albumService.getAlbums(userId))とシグネチャを揃えるために引数として受け取る。
  getAlbums: async (_userId: string): Promise<Album[]> => {
    const data = await gqlRequest<GetAlbumsQuery>(GET_ALBUMS);
    return data.albums.map(gqlToAlbum);
  },

  // userIdはREST版のシグネチャ互換のために受け取る（GraphQL側は
  // context.userで認証・所有権解決を行うため未使用）。
  getAlbumDetail: async (id: string, _userId: string): Promise<AlbumDetail> => {
    try {
      const data = await gqlRequest<GetAlbumDetailQuery>(GET_ALBUM_DETAIL, { id });
      return gqlToAlbumDetail(data.album);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  createAlbum: async (input: CreateAlbumInput): Promise<Album> => {
    try {
      const result = await gqlMutation<CreateAlbumMutation, "createAlbum">(
        CREATE_ALBUM,
        { input: { name: input.name } },
        "createAlbum",
      );
      return gqlToAlbum(result.album);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  // userIdはREST版のシグネチャ互換のために受け取る（未使用）。
  updateAlbum: async (input: UpdateAlbumInput, _userId: string): Promise<Album> => {
    try {
      const { id, name } = input;
      const result = await gqlMutation<UpdateAlbumMutation, "updateAlbum">(
        UPDATE_ALBUM,
        { id, input: { name } },
        "updateAlbum",
      );
      return gqlToAlbum(result.album);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  // userIdはREST版のシグネチャ互換のために受け取る（未使用）。
  deleteAlbum: async (
    id: string,
    _userId: string,
    context: { correlationId: string },
  ): Promise<Album> => {
    try {
      const result = await gqlMutation<DeleteAlbumMutation, "deleteAlbum">(
        DELETE_ALBUM,
        { id, correlationId: context.correlationId },
        "deleteAlbum",
      );
      return gqlToAlbum(result.album);
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },

  // userIdはREST版のシグネチャ互換のために受け取る（GraphQL側は
  // context.userで認証・所有権解決を行うため未使用）。
  reorderAlbumImages: async (
    albumId: string,
    imageIds: string[],
    _userId: string,
  ): Promise<void> => {
    try {
      await gqlMutation<ReorderAlbumImagesMutation, "reorderAlbumImages">(
        REORDER_ALBUM_IMAGES,
        { albumId, imageIds },
        "reorderAlbumImages",
      );
    } catch (e) {
      rethrowAsDomainError(e);
    }
  },
};