import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guards";
import { markSessionElevated } from "@/lib/auth/session";
import { verifyTotpToken } from "@/lib/auth/totp";
import { prisma } from "@/lib/prisma";
import {
  assertSameOrigin,
  buildPublicUrl,
  getRequestContext,
  readFormValue,
} from "@/lib/request";

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  try {
    assertSameOrigin(request);
    const session = await requireAdmin({ allowPendingTotp: true });
    const formData = await request.formData();
    const code = readFormValue(formData, "code");
    const totp = await prisma.totpSecret.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!totp || !verifyTotpToken(totp.secret, code)) {
      return NextResponse.redirect(
        buildPublicUrl(request, "/setup/2fa?error=Invalid+verification+code"),
      );
    }

    await prisma.totpSecret.update({
      where: {
        userId: session.user.id,
      },
      data: {
        confirmedAt: totp.confirmedAt ?? new Date(),
      },
    });

    await markSessionElevated(session.id);
    await writeAuditLog({
      actorId: session.user.id,
      action: "auth.2fa_verified",
      targetType: "User",
      targetId: session.user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return NextResponse.redirect(
      buildPublicUrl(request, "/admin/security?success=Admin+2FA+enabled"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Verification+failed";
    return NextResponse.redirect(buildPublicUrl(request, `/setup/2fa?error=${message}`));
  }
}
