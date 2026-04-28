/**
 * GraphQL Yoga サーバー
 *
 * Next.js App Router のRoute Handlerとして動作
 * /api/graphql エンドポイントを提供する
 */
import { createYoga } from "graphql-yoga";
import { schema } from "@/graphql/schema";
import { createContext } from "@/graphql/context";
import type { NextRequest } from "next/server";

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",

  // コンテキスト生成（Auth0セッション + Prisma）
  context: ({ request }) => createContext(request as NextRequest),

  // マスクされたエラー（本番環境では内部エラーを隠す）
  maskedErrors: process.env.NODE_ENV === "production",

  // GraphiQL（開発環境のみ有効）
  graphiql: process.env.NODE_ENV === "development",

  // Next.js App RouterのFetch APIを使用
  fetchAPI: { Response, Request, Headers },
});

//export { handleRequest as GET, handleRequest as POST };
/**
 * Next.js 15/16 の Route Handler の厳格な型定義
 */
// handleRequest の型から、第2引数（index 1）の型を直接抽出する
type YogaContext = Parameters<typeof handleRequest>[1];

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  // 抽出した型を使ってキャスト。これなら any なしで確実に通ります。
  return handleRequest(
    request, 
    context as unknown as YogaContext
  );
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return handleRequest(
    request, 
    context as unknown as YogaContext
  );
}