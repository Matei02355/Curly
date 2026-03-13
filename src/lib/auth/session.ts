import { createHash, randomBytes } from "node:crypto";

import { Role, type Session, type TotpSecret, type User } from "@prisma/client";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type SessionWithUser = Session & {
  user: User & {
    totpSecret: TotpSecret | null;
  };
};

const SESSION_EXTENSION_THRESHOLD_MS = 30 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.SESSION_TTL_DAYS);
  return expiresAt;
}

export async function createSessionToken(input: {
  userId: string;
  role: Role;
  requiresTwoFactor: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = getSessionExpiry();

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      requiresTwoFactor: input.role === Role.ADMIN || input.requiresTwoFactor,
      elevatedAt: input.role === Role.VIEWER ? new Date() : null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(rawToken),
    },
    include: {
      user: {
        include: {
          totpSecret: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    await clearSessionCookie();
    return null;
  }

  if (Date.now() - session.updatedAt.getTime() > SESSION_EXTENSION_THRESHOLD_MS) {
    const expiresAt = getSessionExpiry();
    await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt,
        lastSeenAt: new Date(),
      },
    });
    cookieStore.set(env.SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }

  return session as SessionWithUser;
}

export async function revokeSessionByToken(rawToken: string) {
  await prisma.session.updateMany({
    where: {
      tokenHash: hashToken(rawToken),
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function markSessionElevated(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      elevatedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });
}

export function isAdminReady(session: SessionWithUser) {
  if (session.user.role !== Role.ADMIN) {
    return true;
  }

  return Boolean(session.user.totpSecret?.confirmedAt && session.elevatedAt);
}

export type AuthSession = SessionWithUser;
