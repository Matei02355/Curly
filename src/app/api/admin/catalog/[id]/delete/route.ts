import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import { deleteManualCatalogItem } from "@/lib/media/manual";
import { assertSameOrigin, buildPublicUrl } from "@/lib/request";

type DeleteCatalogRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: DeleteCatalogRouteProps) {
  try {
    assertSameOrigin(request);
    await requireAdmin();

    const { id } = await params;
    await deleteManualCatalogItem(id);

    return NextResponse.redirect(
      buildPublicUrl(request, "/admin/catalog?success=Catalog+entry+deleted"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/\s+/g, "+") : "Delete+failed";

    return NextResponse.redirect(buildPublicUrl(request, `/admin/catalog?error=${message}`));
  }
}
