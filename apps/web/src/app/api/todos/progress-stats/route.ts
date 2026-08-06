export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/";

// GET /api/todos/progress-stats - 進捗分布統計
export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const stats = await todoService.getProgressStats(user.id);
  return NextResponse.json(stats);
}
