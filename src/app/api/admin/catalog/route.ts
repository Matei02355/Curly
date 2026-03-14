import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import {
  createManualCatalogItem,
  manualCategoryOptions,
  readManualMediaFile,
} from "@/lib/media/manual";
import { assertSameOrigin, buildPublicUrl, readFormValue } from "@/lib/request";

const manualKindOptions = ["Movie", "Series", "Episode"] as const;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireAdmin();

    const formData = await request.formData();
    const category = readFormValue(formData, "category");
    const kind = readFormValue(formData, "kind");
    const title = readFormValue(formData, "title");
    const overview = readFormValue(formData, "overview");
    const sourcePath = readFormValue(formData, "sourcePath");
    const genres = readFormValue(formData, "genres")
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean);
    const year = Number.parseInt(readFormValue(formData, "year"), 10);
    const runtimeMinutes = Number.parseInt(readFormValue(formData, "runtimeMinutes"), 10);
    const communityRating = Number.parseFloat(readFormValue(formData, "communityRating"));

    if (!manualCategoryOptions.includes(category as (typeof manualCategoryOptions)[number])) {
      throw new Error("Choose movies, shows, or anime.");
    }

    if (!manualKindOptions.includes(kind as (typeof manualKindOptions)[number])) {
      throw new Error("Choose Movie, Series, or Episode.");
    }

    if (!title || !overview || !genres.length || !sourcePath) {
      throw new Error("Title, overview, genres, and file path are required.");
    }

    if (!Number.isInteger(year) || year < 1888 || year > 3000) {
      throw new Error("Release year must be between 1888 and 3000.");
    }

    if (!Number.isInteger(runtimeMinutes) || runtimeMinutes < 1) {
      throw new Error("Runtime must be at least 1 minute.");
    }

    if (Number.isNaN(communityRating) || communityRating < 0 || communityRating > 10) {
      throw new Error("Rating must be between 0 and 10.");
    }

    await readManualMediaFile(sourcePath);
    await createManualCatalogItem({
      category: category as (typeof manualCategoryOptions)[number],
      title,
      kind: kind as (typeof manualKindOptions)[number],
      overview,
      year,
      genres,
      runtimeMinutes,
      communityRating,
      sourcePath,
      imageUrl: readFormValue(formData, "imageUrl"),
      backdropUrl: readFormValue(formData, "backdropUrl"),
    });

    return NextResponse.redirect(
      buildPublicUrl(request, "/admin/catalog?success=Catalog+entry+created"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Catalog+update+failed";

    return NextResponse.redirect(buildPublicUrl(request, `/admin/catalog?error=${message}`));
  }
}
