export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";

/**
 * GET /api/todos/search?q=検索クエリ&top_k=5&min_score=0.5
 *
 * セマンティック検索Route Handler
 * 認証チェック後にFastAPIの内部APIを呼び出す
 */
export async function GET(req: Request) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "validation_error", detail: "検索クエリが必要です" },
      { status: 400 }
    );
  }

  const top_k = Number(searchParams.get("top_k") ?? "5");
  const min_score = Number(searchParams.get("min_score") ?? "0.5");

  try {
    const fastapiRes = await fetch(
      `${process.env.BACKEND_API_URL}/search/similar-todos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // 内部APIトークンでFastAPIを認証
          "X-Internal-Token": process.env.INTERNAL_API_SECRET!,
        },
        body: JSON.stringify({
          query: query.trim(),
          user_id: user.id,
          top_k,
          min_score,
        }),
      }
    );

    if (!fastapiRes.ok) {
      const error = await fastapiRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "search_error",
          detail: error.detail ?? "検索処理に失敗しました",
        },
        { status: fastapiRes.status }
      );
    }

    const data = await fastapiRes.json();
    return NextResponse.json(data);

  } catch (e) {
    console.error("Semantic search failed:", e);
    return NextResponse.json(
      { error: "search_error", detail: "検索処理に失敗しました" },
      { status: 500 }
    );
  }
}