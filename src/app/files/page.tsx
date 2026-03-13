import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth/guards";
import { getFileManagerUrl } from "@/lib/media/jellyfin";

export default async function FilesPage() {
  const session = await requireAdmin();

  return (
    <AppShell session={session}>
      <main className="admin-page">
        <section className="section-heading">
          <span className="eyebrow">Vault</span>
          <h1>Admin file manager</h1>
          <p>
            Upload, rename, move, or delete media inside the Curly vault. Changes land in
            the same mounted storage that Jellyfin scans.
          </p>
        </section>
        <section className="iframe-shell">
          <iframe className="file-frame" src={getFileManagerUrl()} title="Curly file manager" />
        </section>
      </main>
    </AppShell>
  );
}
