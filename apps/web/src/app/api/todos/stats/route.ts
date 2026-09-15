export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/";
import { ApiError } from "@/errors/api-error";

// GET /api/todos/stats - 優先度別統計
export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  try {
    const stats = await todoService.getTodoStats(user.id);
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}