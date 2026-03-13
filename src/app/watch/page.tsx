import { AppShell } from "@/components/app-shell";
import { SectionRow } from "@/components/section-row";
import { requireViewer } from "@/lib/auth/guards";
import { getFeaturedMedia, getHomeSections } from "@/lib/media/jellyfin";
import { formatRuntime, truncate } from "@/lib/utils";

export default async function WatchPage() {
  const session = await requireViewer();
  const [featured, sections] = await Promise.all([getFeaturedMedia(), getHomeSections()]);

  return (
    <AppShell session={session}>
      <main>
        <section
          className="hero hero-compact"
          style={
            featured.backdropUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(2, 6, 23, 0.92) 18%, rgba(2, 6, 23, 0.44) 76%, rgba(2, 6, 23, 0.88)), url(${featured.backdropUrl})`,
                }
              : undefined
          }
        >
          <div className="hero-copy">
            <span className="eyebrow">Watch now</span>
            <h1>{featured.title}</h1>
            <p>{truncate(featured.overview, 180)}</p>
            <div className="hero-actions">
              <span className="tag">{featured.kind}</span>
              <span className="tag">{featured.year}</span>
              <span className="tag">{formatRuntime(featured.runTimeTicks)}</span>
            </div>
          </div>
        </section>
        {sections.map((section, index) => (
          <SectionRow
            key={section.id}
            eyebrow={index === 0 ? "Library" : undefined}
            title={section.title}
            items={section.items}
          />
        ))}
      </main>
    </AppShell>
  );
}
