import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { getUserBySub } from "@/features/auth/services/userService";

export const auth0 = new Auth0Client({
  session: {
    rolling: true,
    cookie: {
      sameSite: "none",
      secure: true,
    },
  },
  signInReturnToPath: '/dashboard',
  /*
  async onCallback(error, context, session) {
    console.log("onCallback called");
    console.log("error:", error);
    console.log("context:", context);
    console.log("context.returnTo:", context.returnTo);
    console.log("APP_BASE_URL:", process.env.APP_BASE_URL);
    if (error) {
      return NextResponse.redirect(
        new URL(`/error?error=${error.message}`, process.env.APP_BASE_URL),
      );
    }

    return NextResponse.redirect(
      new URL(context.returnTo || "/dashboard", process.env.APP_BASE_URL),
    );
  },
  */
});

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getUserBySub>>>;

/**
 * Route Handler共通の認証ヘルパー
 * 未認証の場合はnullを返す
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await auth0.getSession();
  if (!session?.user) return null;
  return await getUserBySub(session.user.sub);
}

/**
 * 認証必須版
 * 未認証の場合は401レスポンスとnullを返す
 *
 * 使用例:
 * const { user, response } = await requireAuth();
 * if (!user) return response;
 */
export async function requireAuth(): Promise<
  | { user: AuthenticatedUser; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, response: null };
}
