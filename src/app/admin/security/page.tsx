import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth/guards";
import { listSecurityOverview } from "@/lib/users";

type AdminSecurityPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSecurityPage({
  searchParams,
}: AdminSecurityPageProps) {
  const session = await requireAdmin();
  const [overview, params] = await Promise.all([
    listSecurityOverview(session.user.id),
    searchParams,
  ]);
  const [sessions, logs] = overview;
  const error = typeof params?.error === "string" ? params.error : null;
  const success = typeof params?.success === "string" ? params.success : null;

  return (
    <AppShell session={session}>
      <main className="admin-page">
        <section className="section-heading">
          <span className="eyebrow">Security center</span>
          <h1>Sessions, audit trail, and library controls</h1>
          <p>
            Curly keeps the admin plane locked behind TOTP, tracks key actions, and lets
            you refresh the media catalog without leaving the dashboard.
          </p>
          {error ? <p className="alert error">{error}</p> : null}
          {success ? <p className="alert success">{success}</p> : null}
        </section>

        <section className="admin-grid security-panels">
          <div className="panel-card">
            <span className="eyebrow">Protection</span>
            <h2>2FA status</h2>
            <p>
              Admin TOTP is{" "}
              <strong>
                {session.user.totpSecret?.confirmedAt ? "enabled and verified" : "pending"}
              </strong>
              .
            </p>
            <form action="/api/admin/library/refresh" method="post">
              <button className="solid-button" type="submit">
                Trigger Jellyfin library refresh
              </button>
            </form>
          </div>

          <div className="panel-card">
            <span className="eyebrow">Sessions</span>
            <div className="list-stack">
              {sessions.map((item) => (
                <div className="list-item" key={item.id}>
                  <div>
                    <strong>{item.userAgent ?? "Unknown browser"}</strong>
                    <small>
                      {item.ipAddress ?? "Unknown IP"} • {item.createdAt.toLocaleString()}
                    </small>
                  </div>
                  {item.revokedAt ? (
                    <span className="tag">Revoked</span>
                  ) : (
                    <form action={`/api/admin/sessions/${item.id}/revoke`} method="post">
                      <button className="ghost-button" type="submit">
                        Revoke
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel-card panel-card-wide">
            <span className="eyebrow">Audit trail</span>
            <div className="list-stack">
              {logs.map((entry) => (
                <div className="list-item" key={entry.id}>
                  <div>
                    <strong>{entry.action}</strong>
                    <small>
                      {(entry.actor?.username ?? "system") + " • " + entry.createdAt.toLocaleString()}
                    </small>
                  </div>
                  <span className="tag">{entry.targetType ?? "system"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
