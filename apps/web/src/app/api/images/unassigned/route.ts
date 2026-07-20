export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { getUnassignedImages } from "@/features/images/services/imageService";

// GET /api/images/unassigned - 未所属画像一覧取得
export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const images = await getUnassignedImages(user.id);
  return NextResponse.json(images);
}