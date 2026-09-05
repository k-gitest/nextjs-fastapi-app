/**
 * Album GraphQL リゾルバー（サーバー側）
 *
 * 責務:
 * - 認証チェック
 * - 引数を受け取り既存albumServiceを呼ぶ
 * - GraphQL型への変換
 *
 * ビジネスロジックは features/albums/services/albumService.ts に委譲
 */
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../context";
import { albumService } from "@/features/albums/services/albumService";
import { ValidationError } from "@/errors/validation-error";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import type { Album, AlbumDetail } from "@/features/albums/types";

// ===== 型変換ヘルパー =====

// Service契約（Album）はREST公開DTOと同一の最小契約であり、
// userId/displayOrder/createdAt/updatedAtを含まない。GraphQL側でも
// これらを公開する積極的な理由がないため、SDL・Resolverからも除外する
function toGraphQLAlbum(album: Album) {
    return {
        id: album.id,
        name: album.name,
    };
}

function toGraphQLAlbumDetail(album: AlbumDetail) {
    return {
        id: album.id,
        name: album.name,
        images: album.images.map((image) => ({
            id: image.id,
            originalFileName: image.originalFileName,
            mimeType: image.mimeType,
            fileSize: image.fileSize,
            createdAt: image.createdAt.toISOString(),
            usageCount: image.usageCount,
            albumDisplayOrder: image.albumDisplayOrder,
        })),
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

export const albumQueryResolvers = {
    albums: async (_: unknown, __: unknown, context: GraphQLContext) => {
        requireAuthForQuery(context);

        const albums = await albumService.getAlbums(context.user!.id);
        return albums.map(toGraphQLAlbum);
    },

    album: async (
        _: unknown,
        { id }: { id: string },
        context: GraphQLContext,
    ) => {
        requireAuthForQuery(context);

        try {
            const album = await albumService.getAlbumDetail(id, context.user!.id);
            return toGraphQLAlbumDetail(album);
        } catch (e) {
            if (e instanceof NotFoundError) {
                throw new GraphQLError(e.message, {
                    extensions: {
                        __typename: "NotFoundError",
                        code: "not_found",
                        category: "NOT_FOUND",
                    },
                });
            }
            throw e;
        }
    },
};

// ===== Mutation リゾルバー =====

export const albumMutationResolvers = {
    createAlbum: async (
        _: unknown,
        { input }: { input: { name: string } },
        context: GraphQLContext,
    ) => {
        const authError = requireAuth(context);
        if (authError) return authError;

        try {
            const album = await albumService.createAlbum({
                name: input.name,
                userId: context.user!.id,
            });

            return {
                __typename: "CreateAlbumPayload" as const,
                album: toGraphQLAlbum(album),
            };
        } catch (e) {
            if (e instanceof ConflictError) {
                return {
                    __typename: "ConflictError" as const,
                    category: "CONFLICT",
                    message: e.message,
                    code: "conflict_error",
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
                message: "Album作成に失敗しました",
                code: "internal_error",
            };
        }
    },

    updateAlbum: async (
        _: unknown,
        { id, input }: { id: string; input: { name: string } },
        context: GraphQLContext,
    ) => {
        const authError = requireAuth(context);
        if (authError) return authError;

        try {
            const album = await albumService.updateAlbum(
                { id, name: input.name },
                context.user!.id,
            );

            return {
                __typename: "UpdateAlbumPayload" as const,
                album: toGraphQLAlbum(album),
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
            if (e instanceof ConflictError) {
                return {
                    __typename: "ConflictError" as const,
                    category: "CONFLICT",
                    message: e.message,
                    code: "conflict_error",
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
                message: "Album更新に失敗しました",
                code: "internal_error",
            };
        }
    },

    deleteAlbum: async (
        _: unknown,
        { id, correlationId }: { id: string; correlationId: string },
        context: GraphQLContext,
    ) => {
        const authError = requireAuth(context);
        if (authError) return authError;

        try {
            const deleted = await albumService.deleteAlbum(id, context.user!.id, {
                correlationId,
            });
            return {
                __typename: "DeleteAlbumPayload" as const,
                album: toGraphQLAlbum(deleted),
                deletedId: id,
                message: "Albumを削除しました",
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
                message: "Album削除に失敗しました",
                code: "internal_error",
            };
        }
    },
};