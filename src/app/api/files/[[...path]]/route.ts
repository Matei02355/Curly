import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import { proxyToUpstream, requireFilebrowserBaseUrl } from "@/lib/proxy";

type FileProxyRouteProps = {
  params: Promise<{ path?: string[] }>;
};

async function proxyFilebrowser(request: Request, params: FileProxyRouteProps["params"]) {
  await requireAdmin();
  const { path = [] } = await params;
  const pathname = path.length ? `/${path.join("/")}` : "/";

  return proxyToUpstream(request, requireFilebrowserBaseUrl(), pathname);
}

export async function GET(request: Request, props: FileProxyRouteProps) {
  try {
    return await proxyFilebrowser(request, props.params);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Filebrowser unavailable" },
      { status: 502 },
    );
  }
}

export async function POST(request: Request, props: FileProxyRouteProps) {
  return proxyFilebrowser(request, props.params);
}

export async function PUT(request: Request, props: FileProxyRouteProps) {
  return proxyFilebrowser(request, props.params);
}

export async function PATCH(request: Request, props: FileProxyRouteProps) {
  return proxyFilebrowser(request, props.params);
}

export async function DELETE(request: Request, props: FileProxyRouteProps) {
  return proxyFilebrowser(request, props.params);
}
