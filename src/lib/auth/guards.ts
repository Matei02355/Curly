import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { getSession, isAdminReady } from "@/lib/auth/session";

export async function requireUser() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireViewer() {
  return requireUser();
}

export async function requireAdmin(options?: { allowPendingTotp?: boolean }) {
  const session = await requireUser();

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  if (!options?.allowPendingTotp && !isAdminReady(session)) {
    redirect("/setup/2fa");
  }

  return session;
}
