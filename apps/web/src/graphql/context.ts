/**
 * GraphQL Yoga コンテキスト
 *
 * Django版の context.py に相当
 * Auth0セッションからユーザー情報を取得してリゾルバーに渡す
 */
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export interface GraphQLContext {
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  prisma: typeof prisma;
  cookieHeader: string | null;
}

export async function createContext(request: NextRequest): Promise<GraphQLContext> {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return { user: null, prisma, cookieHeader: null };
    }

    // DBのUserを取得
    const dbUser = await prisma.user.findUnique({
      where: { auth0Id: session.user.sub },
    });

    if (!dbUser) {
      return { user: null, prisma, cookieHeader: null };
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      },
      prisma,
      cookieHeader: request.headers.get("cookie"),
    };
  } catch {
    return { user: null, prisma, cookieHeader: null };
  }
}