import type { NextRequest } from "next/server";

import { headers } from "next/headers";

import { env } from "@/lib/env";

export async function getRequestContext(request?: Request | NextRequest) {
  if (request) {
    return {
      ipAddress:
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        null,
      userAgent: request.headers.get("user-agent"),
    };
  }

  const headerStore = await headers();

  return {
    ipAddress:
      headerStore.get("x-real-ip") ??
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
    userAgent: headerStore.get("user-agent"),
  };
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    throw new Error("Missing origin headers.");
  }

  const originUrl = new URL(origin);

  if (originUrl.host !== host) {
    throw new Error("Cross-site request blocked.");
  }
}

export function readFormValue(
  formData: FormData,
  key: string,
  fallback = "",
) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

function readFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function getPublicOrigin(request: Request | NextRequest) {
  const requestUrl = new URL(request.url);
  const protocol =
    readFirstHeaderValue(request.headers.get("x-forwarded-proto")) ??
    requestUrl.protocol.replace(/:$/, "");
  const host =
    readFirstHeaderValue(request.headers.get("x-forwarded-host")) ??
    readFirstHeaderValue(request.headers.get("host"));

  if (!host) {
    return env.APP_URL;
  }

  return `${protocol}://${host}`;
}

export function buildPublicUrl(
  request: Request | NextRequest,
  pathname: string,
) {
  return new URL(pathname, getPublicOrigin(request));
}
