export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
//import { getUserBySub } from "@/features/auth/services/userService";
import { todoService } from "@/features/todos/services/todoService";

/*
async function getAuthenticatedUser() {
  const session = await auth0.getSession();
  if (!session?.user) return null;
  return await getUserBySub(session.user.sub);
}
*/

// GET /api/todos/progress-stats - 進捗分布統計
export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const stats = await todoService.getProgressStats(user.id);
  return NextResponse.json(stats);
}
