import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/auth/guards";
import { buildStreamUrl, getMediaItem } from "@/lib/media/jellyfin";
import { formatRuntime } from "@/lib/utils";

type WatchItemPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WatchItemPage({ params }: WatchItemPageProps) {
  const session = await requireViewer();
  const { id } = await params;
  const item = await getMediaItem(id);

  return (
    <AppShell session={session}>
      <main className="watch-layout">
        <section className="player-shell">
          <video
            className="player"
            controls
            poster={item.backdropUrl ?? item.imageUrl}
            preload="metadata"
            src={buildStreamUrl(item.id)}
          />
        </section>
        <section className="detail-shell">
          <Link className="inline-link" href="/watch">
            Back to library
          </Link>
          <span className="eyebrow">{item.kind}</span>
          <h1>{item.title}</h1>
          <p>{item.overview}</p>
          <div className="hero-actions">
            <span className="tag">{item.year}</span>
            <span className="tag">{formatRuntime(item.runTimeTicks)}</span>
            <span className="tag">{item.communityRating.toFixed(1)}</span>
          </div>
          <div className="tag-row">
            {item.genres.map((genre) => (
              <span key={genre} className="tag">
                {genre}
              </span>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
