import { env } from "@/lib/env";
import { mockMedia, mockSections, type MediaItem } from "@/lib/media/mock-data";

type JellyfinItem = {
  Id: string;
  Name: string;
  Type: "Movie" | "Series" | "Episode";
  Overview?: string | null;
  PremiereDate?: string | null;
  Genres?: string[] | null;
  RunTimeTicks?: number | null;
  CommunityRating?: number | null;
};

type JellyfinSection = {
  id: string;
  title: string;
  items: MediaItem[];
};

function hasLiveJellyfin() {
  return Boolean(env.jellyfinBaseUrl && env.JELLYFIN_API_KEY);
}

function jellyfinHeaders() {
  const headers = new Headers({
    Accept: "application/json",
    "X-Emby-Token": env.JELLYFIN_API_KEY ?? "",
    Authorization: `MediaBrowser Client="Curly", Device="Curly Web", DeviceId="curly-web", Version="1.0.0", Token="${env.JELLYFIN_API_KEY ?? ""}"`,
  });

  return headers;
}

async function jellyfinFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.jellyfinBaseUrl) {
    throw new Error("Jellyfin is not configured.");
  }

  const response = await fetch(`${env.jellyfinBaseUrl}${path}`, {
    ...init,
    headers: {
      ...Object.fromEntries(jellyfinHeaders().entries()),
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Jellyfin request failed with ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function mapItem(item: JellyfinItem): MediaItem {
  return {
    id: item.Id,
    title: item.Name,
    kind: item.Type,
    overview: item.Overview ?? "No synopsis available yet.",
    year: item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : 2026,
    genres: item.Genres ?? [],
    runTimeTicks: item.RunTimeTicks ?? 0,
    communityRating: item.CommunityRating ?? 0,
    imageUrl: `/api/media/image/${item.Id}?kind=Primary&width=720`,
    backdropUrl: `/api/media/image/${item.Id}?kind=Backdrop&width=1400`,
  };
}

export async function getHomeSections(): Promise<JellyfinSection[]> {
  if (!hasLiveJellyfin()) {
    return mockSections;
  }

  try {
    const [latest, folders] = await Promise.all([
      jellyfinFetch<JellyfinItem[]>(
        `/Items/Latest?Limit=12&Fields=Overview,Genres,RunTimeTicks,PremiereDate,CommunityRating`,
      ),
      jellyfinFetch<{ Items: Array<{ Id: string; Name: string }> }>(
        "/Library/MediaFolders",
      ),
    ]);

    const dynamicSections = await Promise.all(
      folders.Items.slice(0, 3).map(async (folder) => {
        const payload = await jellyfinFetch<{ Items: JellyfinItem[] }>(
          `/Items?ParentId=${folder.Id}&Recursive=true&IncludeItemTypes=Movie,Series,Episode&SortBy=DateCreated&SortOrder=Descending&Limit=10&Fields=Overview,Genres,RunTimeTicks,PremiereDate,CommunityRating`,
        );

        return {
          id: folder.Id,
          title: folder.Name,
          items: payload.Items.map(mapItem),
        };
      }),
    );

    return [
      {
        id: "latest",
        title: "Just Added",
        items: latest.map(mapItem),
      },
      ...dynamicSections.filter((section) => section.items.length > 0),
    ];
  } catch {
    return mockSections;
  }
}

export async function getFeaturedMedia() {
  const sections = await getHomeSections();
  return sections[0]?.items[0] ?? mockMedia[0];
}

export async function getMediaItem(itemId: string) {
  if (!hasLiveJellyfin()) {
    return mockMedia.find((item) => item.id === itemId) ?? mockMedia[0];
  }

  try {
    const item = await jellyfinFetch<JellyfinItem>(
      `/Items/${itemId}?Fields=Overview,Genres,RunTimeTicks,PremiereDate,CommunityRating`,
    );

    return mapItem(item);
  } catch {
    return mockMedia.find((item) => item.id === itemId) ?? mockMedia[0];
  }
}

export async function refreshLibrary() {
  if (!hasLiveJellyfin()) {
    return false;
  }

  await jellyfinFetch<void>("/Library/Refresh", {
    method: "POST",
  });

  return true;
}

export function buildStreamUrl(itemId: string) {
  return `/api/media/stream/${itemId}`;
}

export function getFileManagerUrl() {
  return env.FILEBROWSER_PROXY_PATH;
}

export function getJellyfinUpstreamUrl(pathname: string) {
  if (!env.jellyfinBaseUrl) {
    throw new Error("Jellyfin is not configured.");
  }

  return `${env.jellyfinBaseUrl}${pathname}`;
}
