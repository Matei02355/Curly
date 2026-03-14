import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import { assertSameOrigin, buildPublicUrl, getRequestContext } from "@/lib/request";
import { disableUserRecord } from "@/lib/users";

type DisableRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: DisableRouteProps) {
  const context = await getRequestContext(request);

  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const { id } = await params;

    if (id === session.user.id) {
      throw new Error("You cannot disable the current admin session.");
    }

    await disableUserRecord({
      userId: id,
      actorId: session.user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return NextResponse.redirect(
      buildPublicUrl(request, "/admin/users?success=User+disabled"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Disable+failed";
    return NextResponse.redirect(buildPublicUrl(request, `/admin/users?error=${message}`));
  }
}
