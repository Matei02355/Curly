import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MediaCard } from "@/components/media-card";
import { SectionRow } from "@/components/section-row";
import { getSession } from "@/lib/auth/session";
import { getFeaturedMedia, getHomeSections } from "@/lib/media/jellyfin";
import { truncate } from "@/lib/utils";

export default async function Home() {
  const [session, featured, sections] = await Promise.all([
    getSession(),
    getFeaturedMedia(),
    getHomeSections(),
  ]);

  return (
    <AppShell session={session}>
      <main>
        <section
          className="hero"
          style={
            featured.backdropUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(2, 6, 23, 0.95) 20%, rgba(2, 6, 23, 0.55) 70%, rgba(2, 6, 23, 0.78)), url(${featured.backdropUrl})`,
                }
              : undefined
          }
        >
          <div className="hero-copy">
            <span className="eyebrow">
              {session ? "Your private cinema stack" : "Curated, hardened, self-hosted"}
            </span>
            <h1>{featured.title}</h1>
            <p>{truncate(featured.overview, 220)}</p>
            <div className="hero-actions">
              <Link className="solid-button" href={session ? `/watch/${featured.id}` : "/login"}>
                {session ? "Play now" : "Enter Curly"}
              </Link>
              {session?.user.role === "ADMIN" ? (
                <Link className="ghost-button" href="/admin/security">
                  Security center
                </Link>
              ) : (
                <a className="ghost-button" href="#features">
                  Explore features
                </a>
              )}
            </div>
          </div>
          <div className="hero-panel">
            <div className="glass-card">
              <span className="eyebrow">Highlights</span>
              <ul className="feature-list">
                <li>Custom watch UI over Jellyfin media delivery</li>
                <li>Admin-only file manager behind Curly auth</li>
                <li>Argon2id sessions, audit trail, and admin TOTP</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="content-grid" id="features">
          <div className="feature-blurb">
            <span className="eyebrow">The experience</span>
            <h2>One panel for streaming, uploads, and security</h2>
            <p>
              Curly gives you a branded front end for movies and anime, while keeping
              the proven backend pieces hidden behind the app. Upload through the file
              vault, refresh the library, and stream from the same domain.
            </p>
          </div>
          <MediaCard item={featured} />
        </section>

        {sections.map((section, index) => (
          <SectionRow
            key={section.id}
            eyebrow={index === 0 ? "Dashboard" : undefined}
            title={section.title}
            items={section.items}
          />
        ))}
      </main>
    </AppShell>
  );
}
