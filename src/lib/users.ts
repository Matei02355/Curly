import { Role, type User } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export async function authenticateWithPassword(
  username: string,
  password: string,
) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: {
      totpSecret: true,
    },
  });

  if (!user || user.disabledAt) {
    return null;
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return null;
  }

  return user;
}

export async function createUserRecord(input: {
  username: string;
  password: string;
  role: Role;
  displayName?: string;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const username = input.username.toLowerCase();
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      username,
      displayName: input.displayName?.trim() || null,
      passwordHash,
      role: input.role,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "user.create",
    targetType: "User",
    targetId: user.id,
    metadata: {
      username: user.username,
      role: user.role,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return user;
}

export async function resetUserPassword(input: {
  userId: string;
  newPassword: string;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const passwordHash = await hashPassword(input.newPassword);

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: {
      passwordHash,
      sessions: {
        updateMany: {
          where: { revokedAt: null },
          data: { revokedAt: new Date() },
        },
      },
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "user.reset_password",
    targetType: "User",
    targetId: input.userId,
    metadata: {
      username: user.username,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return user;
}

export async function disableUserRecord(input: {
  userId: string;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        disabledAt: null,
      },
    });

    if (adminCount <= 1) {
      throw new Error("Curly requires at least one active admin.");
    }
  }

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      disabledAt: new Date(),
      sessions: {
        updateMany: {
          where: { revokedAt: null },
          data: { revokedAt: new Date() },
        },
      },
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "user.disable",
    targetType: "User",
    targetId: input.userId,
    metadata: {
      username: updated.username,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return updated;
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: {
      totpSecret: true,
      sessions: {
        where: {
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      },
    },
  });
}

export async function listSecurityOverview(userId: string) {
  return Promise.all([
    prisma.session.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.auditLog.findMany({
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        actor: true,
      },
    }),
  ]);
}

export function ensurePasswordStrength(password: string) {
  if (password.length < 12) {
    throw new Error("Passwords must be at least 12 characters.");
  }
}

export function parseRole(role: string): Role {
  if (role.toLowerCase() === "admin") {
    return Role.ADMIN;
  }

  return Role.VIEWER;
}

export function isUserActive(user: Pick<User, "disabledAt">) {
  return !user.disabledAt;
}
