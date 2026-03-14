import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guards";
import { refreshLibrary } from "@/lib/media/jellyfin";
import { assertSameOrigin, buildPublicUrl, getRequestContext } from "@/lib/request";

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    await refreshLibrary();
    await writeAuditLog({
      actorId: session.user.id,
      action: "library.refresh",
      targetType: "Library",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return NextResponse.redirect(
      buildPublicUrl(request, "/admin/security?success=Library+refresh+requested"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Refresh+failed";
    return NextResponse.redirect(
      buildPublicUrl(request, `/admin/security?error=${message}`),
    );
  }
}
