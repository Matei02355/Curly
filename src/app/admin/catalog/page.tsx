import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { listManualCatalogItems, manualCategoryOptions } from "@/lib/media/manual";

type AdminCatalogPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const kindOptions = ["Movie", "Series", "Episode"] as const;

export default async function AdminCatalogPage({
  searchParams,
}: AdminCatalogPageProps) {
  const [session, items, params] = await Promise.all([
    requireAdmin(),
    listManualCatalogItems(),
    searchParams,
  ]);
  const error = typeof params?.error === "string" ? params.error : null;
  const success = typeof params?.success === "string" ? params.success : null;

  return (
    <AppShell session={session}>
      <main className="admin-page">
        <section className="admin-grid">
          <div className="panel-card">
            <span className="eyebrow">Catalog editor</span>
            <h1>Manually add movies, shows, and anime</h1>
            <p>
              Register local media files directly in Curly. Put the file under{" "}
              <code>{env.MEDIA_ROOT}</code>, then enter its relative path here.
            </p>
            <p className="helper-copy">
              Example paths: <code>movies/dune-part-two.mp4</code>,{" "}
              <code>shows/fallout-s01e01.mp4</code>,{" "}
              <code>anime/pluto-episode-01.mp4</code>.
            </p>
            {error ? <p className="alert error">{error}</p> : null}
            {success ? <p className="alert success">{success}</p> : null}
            <form action="/api/admin/catalog" className="stack-form" method="post">
              <label>
                Category
                <select defaultValue="movies" name="category">
                  {manualCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select defaultValue="Movie" name="kind">
                  {kindOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input name="title" required type="text" />
              </label>
              <label>
                Overview
                <textarea name="overview" required rows={5} />
              </label>
              <label>
                Genres
                <input
                  name="genres"
                  placeholder="Anime, Mystery, Sci-Fi"
                  required
                  type="text"
                />
              </label>
              <label>
                File path inside media root
                <input
                  name="sourcePath"
                  placeholder="anime/spiral-archive/episode-01.mp4"
                  required
                  type="text"
                />
              </label>
              <label>
                Release year
                <input defaultValue="2026" max="3000" min="1888" name="year" required type="number" />
              </label>
              <label>
                Runtime in minutes
                <input defaultValue="24" min="1" name="runtimeMinutes" required type="number" />
              </label>
              <label>
                Rating
                <input
                  defaultValue="8.0"
                  max="10"
                  min="0"
                  name="communityRating"
                  required
                  step="0.1"
                  type="number"
                />
              </label>
              <label>
                Poster URL
                <input name="imageUrl" placeholder="https://..." type="url" />
              </label>
              <label>
                Backdrop URL
                <input name="backdropUrl" placeholder="https://..." type="url" />
              </label>
              <button className="solid-button wide" type="submit">
                Add to Curly
              </button>
            </form>
          </div>

          <div className="panel-card">
            <span className="eyebrow">Manual library</span>
            <h2>Current entries</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>File</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          <small>
                            {item.kind} • {item.year} • {item.communityRating.toFixed(1)}
                          </small>
                        </td>
                        <td>{item.category}</td>
                        <td className="table-path">{item.sourcePath}</td>
                        <td>{new Date(item.createdAt).toLocaleString()}</td>
                        <td>
                          <div className="action-cluster">
                            <Link className="ghost-button" href={`/watch/${item.id}`}>
                              Preview
                            </Link>
                            <form action={`/api/admin/catalog/${item.id}/delete`} method="post">
                              <button className="danger-button" type="submit">
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        No manual entries yet. Add a file under <code>{env.MEDIA_ROOT}</code>{" "}
                        and register it above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
