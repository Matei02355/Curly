import { NextResponse } from "next/server";

import { getSession, isAdminReady } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  if (!session || session.user.role !== "ADMIN" || !isAdminReady(session)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return new NextResponse("OK", { status: 200 });
}
