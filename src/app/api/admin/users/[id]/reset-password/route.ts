import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import { assertSameOrigin, getRequestContext, readFormValue } from "@/lib/request";
import { ensurePasswordStrength, resetUserPassword } from "@/lib/users";

type ResetPasswordRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: ResetPasswordRouteProps) {
  const context = await getRequestContext(request);

  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const { id } = await params;
    const formData = await request.formData();
    const password = readFormValue(formData, "password");

    ensurePasswordStrength(password);

    await resetUserPassword({
      userId: id,
      newPassword: password,
      actorId: session.user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return NextResponse.redirect(
      new URL("/admin/users?success=Password+reset", request.url),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Reset+failed";
    return NextResponse.redirect(new URL(`/admin/users?error=${message}`, request.url));
  }
}
