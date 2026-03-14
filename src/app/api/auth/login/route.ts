import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { createSessionToken } from "@/lib/auth/session";
import { assertRateLimit, clearRateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  buildPublicUrl,
  getRequestContext,
  readFormValue,
} from "@/lib/request";
import { authenticateWithPassword } from "@/lib/users";

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  try {
    assertSameOrigin(request);

    const formData = await request.formData();
    const username = readFormValue(formData, "username").toLowerCase();
    const password = readFormValue(formData, "password");
    const rateKey = `${context.ipAddress ?? "unknown"}:${username}`;

    assertRateLimit(rateKey);

    const user = await authenticateWithPassword(username, password);

    if (!user) {
      await writeAuditLog({
        action: "auth.login_failed",
        metadata: { username },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return NextResponse.redirect(
        buildPublicUrl(request, "/login?error=Invalid+username+or+password"),
      );
    }

    clearRateLimit(rateKey);

    await createSessionToken({
      userId: user.id,
      role: user.role,
      requiresTwoFactor: Boolean(user.totpSecret?.confirmedAt),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await writeAuditLog({
      actorId: user.id,
      action: "auth.login",
      targetType: "User",
      targetId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return NextResponse.redirect(
      buildPublicUrl(request, user.role === "ADMIN" ? "/setup/2fa" : "/"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Login+failed";
    return NextResponse.redirect(buildPublicUrl(request, `/login?error=${message}`));
  }
}
