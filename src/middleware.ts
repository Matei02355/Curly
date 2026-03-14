import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { buildPublicUrl } from "@/lib/request";

const protectedPrefixes = ["/watch", "/files", "/admin", "/setup/2fa"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!request.cookies.get(env.SESSION_COOKIE_NAME)?.value) {
    return NextResponse.redirect(buildPublicUrl(request, "/login"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/watch/:path*", "/files/:path*", "/admin/:path*", "/setup/2fa"],
};
