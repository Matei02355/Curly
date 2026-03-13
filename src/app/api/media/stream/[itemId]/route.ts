import { NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { proxyToUpstream } from "@/lib/proxy";

type StreamRouteProps = {
  params: Promise<{ itemId: string }>;
};

export async function GET(request: Request, { params }: StreamRouteProps) {
  await requireViewer();

  if (!env.jellyfinBaseUrl || !env.JELLYFIN_API_KEY) {
    return NextResponse.json(
      { error: "Jellyfin is not configured yet." },
      { status: 503 },
    );
  }

  const { itemId } = await params;
  const url = new URL(request.url);
  const upstreamPath = `/Videos/${itemId}/stream.mp4?videoCodec=h264&audioCodec=aac&maxAudioChannels=2&context=Streaming&maxStreamingBitrate=8000000${url.search ? `&${url.search.slice(1)}` : ""}`;

  return proxyToUpstream(request, env.jellyfinBaseUrl, upstreamPath, {
    "X-Emby-Token": env.JELLYFIN_API_KEY,
    Authorization: `MediaBrowser Client="Curly", Device="Curly Web", DeviceId="curly-web", Version="1.0.0", Token="${env.JELLYFIN_API_KEY}"`,
  });
}
