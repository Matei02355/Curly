import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import {
  assertSameOrigin,
  buildPublicUrl,
  getRequestContext,
  readFormValue,
} from "@/lib/request";
import { createUserRecord, ensurePasswordStrength, parseRole } from "@/lib/users";

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const formData = await request.formData();
    const password = readFormValue(formData, "password");

    ensurePasswordStrength(password);

    await createUserRecord({
      username: readFormValue(formData, "username"),
      displayName: readFormValue(formData, "displayName"),
      password,
      role: parseRole(readFormValue(formData, "role")),
      actorId: session.user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return NextResponse.redirect(
      buildPublicUrl(request, "/admin/users?success=User+created"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "User+creation+failed";
    return NextResponse.redirect(buildPublicUrl(request, `/admin/users?error=${message}`));
  }
}
