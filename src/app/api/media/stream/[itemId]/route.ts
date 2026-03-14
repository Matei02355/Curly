import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { getManualCatalogItem, readManualMediaFile } from "@/lib/media/manual";
import { proxyToUpstream } from "@/lib/proxy";

type StreamRouteProps = {
  params: Promise<{ itemId: string }>;
};

const contentTypeByExtension: Record<string, string> = {
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "video/ogg",
  ".ogv": "video/ogg",
  ".wav": "audio/wav",
  ".webm": "video/webm",
};

function getContentType(filePath: string) {
  return contentTypeByExtension[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function streamManualFile(request: Request, itemId: string) {
  const manualItem = await getManualCatalogItem(itemId);

  if (!manualItem) {
    return null;
  }

  const { absolutePath, stats } = await readManualMediaFile(manualItem.sourcePath);
  const range = request.headers.get("range");
  let start = 0;
  let end = stats.size - 1;
  let status = 200;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);

    if (!match) {
      return NextResponse.json({ error: "Invalid media range request." }, { status: 416 });
    }

    const [, startValue, endValue] = match;
    start = startValue ? Number.parseInt(startValue, 10) : 0;
    end = endValue ? Number.parseInt(endValue, 10) : stats.size - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      end < start ||
      end >= stats.size
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stats.size}`,
        },
      });
    }

    status = 206;
  }

  const stream = createReadStream(absolutePath, {
    start,
    end,
  });
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Length": String(end - start + 1),
    "Content-Type": getContentType(absolutePath),
  });

  if (status === 206) {
    headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
  }

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers,
  });
}

export async function GET(request: Request, { params }: StreamRouteProps) {
  await requireViewer();
  const { itemId } = await params;

  try {
    const manualResponse = await streamManualFile(request, itemId);

    if (manualResponse) {
      return manualResponse;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual media is unavailable." },
      { status: 404 },
    );
  }

  if (!env.jellyfinBaseUrl || !env.JELLYFIN_API_KEY) {
    return NextResponse.json(
      { error: "Jellyfin is not configured yet." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const upstreamPath = `/Videos/${itemId}/stream.mp4?videoCodec=h264&audioCodec=aac&maxAudioChannels=2&context=Streaming&maxStreamingBitrate=8000000${url.search ? `&${url.search.slice(1)}` : ""}`;

  return proxyToUpstream(request, env.jellyfinBaseUrl, upstreamPath, {
    "X-Emby-Token": env.JELLYFIN_API_KEY,
    Authorization: `MediaBrowser Client="Curly", Device="Curly Web", DeviceId="curly-web", Version="1.0.0", Token="${env.JELLYFIN_API_KEY}"`,
  });
}
