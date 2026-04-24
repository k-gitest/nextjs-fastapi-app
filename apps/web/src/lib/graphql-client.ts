/**
 * GraphQL クライアント
 *
 * Django版からの変更点:
 * - authenticatedFetch → credentials: "include"（Auth0のCookieを自動送信）
 * - GRAPHQL_URL → /api/graphql（Next.js内部エンドポイント）
 * - エラー変換ロジック（convertToApiError等）はそのまま流用
 */
import { ClientError, GraphQLClient } from "graphql-request";
import { ApiError } from "@/errors/api-error";
import { NetworkError } from "@/errors/network-error";
import { headers as nextHeaders } from "next/headers";

/**
 * ベースURLの決定
 * サーバーサイドならlocalhostを優先し、トンネルの認証をバイパスする
 */
const getBaseUrl = () => {
  if (typeof window === "undefined") {
    // サーバーサイド実行時
    return "http://localhost:3000"; 
  }
  // クライアントサイド実行時
  return process.env.NEXT_PUBLIC_APP_BASE_URL || "";
};

export const graphqlClient = new GraphQLClient(`${getBaseUrl()}/api/graphql`, {
  // Auth0のCookieを自動送信（Django版のauthenticatedFetch相当）
  credentials: "include",
});

/**
 * GraphQLリクエストのラッパー
 * エラーをApiErrorに変換（Django版から流用）
 */
export async function gqlRequest<T>(
  document: string,
  variables?: Record<string, unknown>
): Promise<T> {
  // --- サーバーサイドでのクッキー補完ロジックを追加 ---
  const requestHeaders: Record<string, string> = {};
  
  if (typeof window === "undefined") {
    try {
      const h = await nextHeaders();
      const cookie = h.get("cookie");
      if (cookie) {
        requestHeaders["cookie"] = cookie;
      }

      // 【重要】Hostヘッダーを上書きしてAuth0などのセッションチェックを整合させる
      // ※環境によっては必要です
      const host = h.get("host");
      if (host) {
        requestHeaders["host"] = host;
      }
    } catch (e) {
      // headers() は Server Components や API Route 以外ではエラーになるため安全策
      console.warn("Header retrieval failed:", e);
    }
  }
  // ----------------------------------------------

  try {
    return await graphqlClient.request<T>({
      document,
      variables,
      requestHeaders,
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error instanceof ClientError) {
      console.error("GraphQL Request failed:", JSON.stringify(error.response, null, 2));
    }
    throw convertToApiError(error);
  }
}

export async function gqlMutation<
  TMutation,
  TKey extends keyof TMutation = keyof TMutation,
  >(
    document: string,
    variables?: Record<string, unknown>,
    resultKey?: TKey
  ): Promise<TMutation[TKey]> {
  const data = await gqlRequest<TMutation>(document, variables);

  if (resultKey && data && typeof data === "object" && resultKey in data) {
    const result = data[resultKey];

    if (isErrorResult(result)) {
      throw resultToApiError(result);
    }

    return result as TMutation[TKey];
  }

  return data as unknown as TMutation[TKey];
}

// ===== ヘルパー関数（Django版から流用）=====

function convertToApiError(error: unknown): Error {
  if (error instanceof ClientError) {
    const graphqlErrors = error.response.errors;

    if (graphqlErrors && graphqlErrors.length > 0) {
      const firstError = graphqlErrors[0];

      if (firstError.extensions?.__typename) {
        const typename = firstError.extensions.__typename as string;
        const statusMap: Record<string, number> = {
          ValidationError: 400,
          AuthenticationError: 401,
          AuthorizationError: 403,
          NotFoundError: 404,
          ConflictError: 409,
          RateLimitError: 429,
          ExternalServiceError: 503,
          InternalError: 500,
        };

        return new ApiError(
          statusMap[typename] || 500,
          firstError.message,
          {
            code: firstError.extensions.code,
            field: firstError.extensions.field,
            ...((firstError.extensions.data as object) || {}),
            __typename: typename,
          },
          error
        );
      }
    }

    return new ApiError(
      500,
      error.message || "GraphQLエラーが発生しました",
      { code: "graphql_error" },
      error
    );
  }

  if (error instanceof Error) {
    return new NetworkError(
      error.message || "ネットワークエラーが発生しました",
      error
    );
  }

  return new NetworkError("予期しないエラーが発生しました", error);
}

interface ResultPatternResponse {
  __typename: string;
  message?: string;
  category?: string;
  code?: string;
  field?: string;
  [key: string]: unknown;
}

function isErrorResult(result: unknown): result is ResultPatternResponse {
  if (!result || typeof result !== "object") return false;

  const errorTypes = [
    "ValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "ConflictError",
    "RateLimitError",
    "ExternalServiceError",
    "InternalError",
  ];

  return (
    "__typename" in result &&
    typeof result.__typename === "string" &&
    errorTypes.includes(result.__typename)
  );
}

function resultToApiError(result: ResultPatternResponse): ApiError {
  const statusMap: Record<string, number> = {
    ValidationError: 400,
    AuthenticationError: 401,
    AuthorizationError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    RateLimitError: 429,
    ExternalServiceError: 503,
    InternalError: 500,
  };

  return new ApiError(
    statusMap[result.__typename] || 500,
    result.message || "エラーが発生しました",
    result
  );
}