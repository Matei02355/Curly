import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/request";

type RevokeRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RevokeRouteProps) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const { id } = await params;

    await prisma.session.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return NextResponse.redirect(
      new URL("/admin/security?success=Session+revoked", request.url),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Revoke+failed";
    return NextResponse.redirect(new URL(`/admin/security?error=${message}`, request.url));
  }
}
