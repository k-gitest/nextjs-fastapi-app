export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionExpiryStatus } from "@/features/auth/services/sessionStatusService";
import { logServiceError } from "@/lib/server-logger";
import type { SessionStatus } from "@/features/auth/types";

export async function GET() {
  const { authenticated, expiresAt } = await getSessionExpiryStatus();

  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (expiresAt === null) {
    logServiceError(
      new Error("session.exp not found on Auth0 session"),
      { component: "session-status" },
    );
    const body: SessionStatus = { status: "unknown" };
    return NextResponse.json(body, { status: 200 });
  }

  const body: SessionStatus = { status: "ok", expiresAt };
  return NextResponse.json(body, { status: 200 });
}