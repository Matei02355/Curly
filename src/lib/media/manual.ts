import fs from "node:fs/promises";
import path from "node:path";

import { Prisma, type AppSetting } from "@prisma/client";
import { z } from "zod";

import { env } from "@/lib/env";
import type { MediaItem } from "@/lib/media/mock-data";
import { prisma } from "@/lib/prisma";

const manualCatalogKey = "manualCatalog";

export const manualCategoryOptions = ["movies", "shows", "anime"] as const;

export type ManualCatalogCategory = (typeof manualCategoryOptions)[number];

export type ManualCatalogItem = MediaItem & {
  category: ManualCatalogCategory;
  sourcePath: string;
  createdAt: string;
};

type ManualSection = {
  id: string;
  title: string;
  items: MediaItem[];
};

type CreateManualCatalogInput = {
  category: ManualCatalogCategory;
  title: string;
  kind: MediaItem["kind"];
  overview: string;
  year: number;
  genres: string[];
  runtimeMinutes: number;
  communityRating: number;
  sourcePath: string;
  imageUrl?: string;
  backdropUrl?: string;
};

const manualCatalogItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["Movie", "Series", "Episode"]),
  overview: z.string().min(1),
  year: z.number().int().min(1888).max(3000),
  genres: z.array(z.string().min(1)),
  runTimeTicks: z.number().int().nonnegative(),
  communityRating: z.number().min(0).max(10),
  imageUrl: z.string().url().optional(),
  backdropUrl: z.string().url().optional(),
  category: z.enum(manualCategoryOptions),
  sourcePath: z.string().min(1),
  createdAt: z.string().datetime(),
});

const manualCatalogSchema = z.array(manualCatalogItemSchema);

const sectionTitles: Record<ManualCatalogCategory, string> = {
  movies: "Manual Movies",
  shows: "Manual Shows",
  anime: "Manual Anime",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeSourcePath(sourcePath: string) {
  const normalized = sourcePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized) {
    throw new Error("Media file path is required.");
  }

  const segments = normalized.split("/");

  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Media file path must stay inside the Curly media root.");
  }

  return normalized;
}

function normalizeOptionalUrl(value?: string) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : undefined;
}

function sortManualItems(items: ManualCatalogItem[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function readManualCatalogValue(setting: AppSetting | null) {
  if (!setting) {
    return [];
  }

  const parsed = manualCatalogSchema.safeParse(setting.value);
  return parsed.success ? sortManualItems(parsed.data) : [];
}

async function saveManualCatalog(items: ManualCatalogItem[]) {
  await prisma.appSetting.upsert({
    where: {
      key: manualCatalogKey,
    },
    update: {
      value: items as Prisma.InputJsonValue,
    },
    create: {
      key: manualCatalogKey,
      value: items as Prisma.InputJsonValue,
    },
  });
}

export async function listManualCatalogItems() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: manualCatalogKey,
    },
  });

  return readManualCatalogValue(setting);
}

export async function getManualCatalogItem(itemId: string) {
  const items = await listManualCatalogItems();
  return items.find((item) => item.id === itemId) ?? null;
}

export async function createManualCatalogItem(input: CreateManualCatalogInput) {
  const items = await listManualCatalogItems();
  const sourcePath = normalizeSourcePath(input.sourcePath);
  const item: ManualCatalogItem = {
    id: `manual-${slugify(input.title) || "entry"}-${Date.now().toString(36)}`,
    title: input.title.trim(),
    kind: input.kind,
    overview: input.overview.trim(),
    year: input.year,
    genres: input.genres,
    runTimeTicks: Math.max(0, Math.round(input.runtimeMinutes * 60 * 10_000_000)),
    communityRating: input.communityRating,
    category: input.category,
    sourcePath,
    createdAt: new Date().toISOString(),
    ...(normalizeOptionalUrl(input.imageUrl)
      ? { imageUrl: normalizeOptionalUrl(input.imageUrl) }
      : {}),
    ...(normalizeOptionalUrl(input.backdropUrl)
      ? { backdropUrl: normalizeOptionalUrl(input.backdropUrl) }
      : {}),
  };

  await saveManualCatalog(sortManualItems([item, ...items]));
  return item;
}

export async function deleteManualCatalogItem(itemId: string) {
  const items = await listManualCatalogItems();
  const nextItems = items.filter((item) => item.id !== itemId);

  if (nextItems.length === items.length) {
    throw new Error("Manual catalog entry was not found.");
  }

  await saveManualCatalog(nextItems);
}

export async function listManualSections(): Promise<ManualSection[]> {
  const items = await listManualCatalogItems();

  return manualCategoryOptions
    .map((category) => ({
      id: `manual-${category}`,
      title: sectionTitles[category],
      items: items.filter((item) => item.category === category),
    }))
    .filter((section) => section.items.length > 0);
}

export async function readManualMediaFile(sourcePath: string) {
  const normalizedSourcePath = normalizeSourcePath(sourcePath);
  const mediaRoot = path.resolve(env.MEDIA_ROOT);
  const absolutePath = path.resolve(mediaRoot, normalizedSourcePath);
  const relativePath = path.relative(mediaRoot, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Media file path must stay inside the Curly media root.");
  }

  const stats = await fs.stat(absolutePath);

  if (!stats.isFile()) {
    throw new Error("Media file path must point to a file.");
  }

  return {
    absolutePath,
    stats,
  };
}
