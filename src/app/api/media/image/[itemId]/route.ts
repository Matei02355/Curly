import { NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { proxyToUpstream } from "@/lib/proxy";

type ImageRouteProps = {
  params: Promise<{ itemId: string }>;
};

export async function GET(request: Request, { params }: ImageRouteProps) {
  await requireViewer();
  const { itemId } = await params;

  if (!env.jellyfinBaseUrl || !env.JELLYFIN_API_KEY) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="520">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#ff7448" offset="0%" />
            <stop stop-color="#0f172a" offset="100%" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" />
        <text x="50%" y="50%" dominant-baseline="middle" fill="#f8fafc" font-family="sans-serif" font-size="42" text-anchor="middle">
          Curly Preview ${itemId}
        </text>
      </svg>
    `;

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
      },
    });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "Primary";

  return proxyToUpstream(
    request,
    env.jellyfinBaseUrl,
    `/Items/${itemId}/Images/${kind}`,
    {
      "X-Emby-Token": env.JELLYFIN_API_KEY,
      Authorization: `MediaBrowser Client="Curly", Device="Curly Web", DeviceId="curly-web", Version="1.0.0", Token="${env.JELLYFIN_API_KEY}"`,
    },
  );
}
