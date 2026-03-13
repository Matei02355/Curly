import { env } from "@/lib/env";

export async function proxyToUpstream(
  request: Request,
  upstreamBase: string,
  path: string,
  extraHeaders?: HeadersInit,
) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(path, upstreamBase);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));
  for (const [key, value] of new Headers(extraHeaders).entries()) {
    headers.set(key, value);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    duplex: body ? "half" : undefined,
  } as RequestInit & { duplex?: "half" });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-security-policy");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export function requireFilebrowserBaseUrl() {
  if (!env.filebrowserBaseUrl) {
    throw new Error("Filebrowser is not configured.");
  }

  return env.filebrowserBaseUrl;
}
