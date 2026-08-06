export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/";

// GET /api/todos/stats - 優先度別統計
export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const stats = await todoService.getTodoStats(user.id);
  return NextResponse.json(stats);
}