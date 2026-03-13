import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { writeAuditLog } from "@/lib/audit";
import { clearSessionCookie, getSession, revokeSessionByToken } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { assertSameOrigin, getRequestContext } from "@/lib/request";

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  try {
    assertSameOrigin(request);
    const session = await getSession();
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

    if (rawToken) {
      await revokeSessionByToken(rawToken);
    }

    await clearSessionCookie();

    if (session) {
      await writeAuditLog({
        actorId: session.user.id,
        action: "auth.logout",
        targetType: "Session",
        targetId: session.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }
  } catch {
    await clearSessionCookie();
  }

  return NextResponse.redirect(new URL("/login?message=Logged+out", request.url));
}
