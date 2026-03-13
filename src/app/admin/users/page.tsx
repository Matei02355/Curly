import { Role } from "@prisma/client";

import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth/guards";
import { listUsers } from "@/lib/users";

type AdminUsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [session, users, params] = await Promise.all([
    requireAdmin(),
    listUsers(),
    searchParams,
  ]);
  const error = typeof params?.error === "string" ? params.error : null;
  const success = typeof params?.success === "string" ? params.success : null;

  return (
    <AppShell session={session}>
      <main className="admin-page">
        <section className="admin-grid">
          <div className="panel-card">
            <span className="eyebrow">Admin</span>
            <h1>User management</h1>
            <p>Create streaming accounts, reset passwords, and suspend access.</p>
            {error ? <p className="alert error">{error}</p> : null}
            {success ? <p className="alert success">{success}</p> : null}
            <form action="/api/admin/users" className="stack-form" method="post">
              <label>
                Username
                <input name="username" required type="text" />
              </label>
              <label>
                Display name
                <input name="displayName" type="text" />
              </label>
              <label>
                Initial password
                <input name="password" required type="password" />
              </label>
              <label>
                Role
                <select defaultValue={Role.VIEWER} name="role">
                  <option value={Role.VIEWER}>Viewer</option>
                  <option value={Role.ADMIN}>Admin</option>
                </select>
              </label>
              <button className="solid-button wide" type="submit">
                Create account
              </button>
            </form>
          </div>

          <div className="panel-card">
            <span className="eyebrow">Accounts</span>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>2FA</th>
                    <th>Status</th>
                    <th>Sessions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.displayName ?? user.username}</strong>
                        <small>{user.username}</small>
                      </td>
                      <td>{user.role.toLowerCase()}</td>
                      <td>{user.totpSecret?.confirmedAt ? "Enabled" : "Pending"}</td>
                      <td>{user.disabledAt ? "Disabled" : "Active"}</td>
                      <td>{user.sessions.length}</td>
                      <td>
                        <div className="action-cluster">
                          <form
                            action={`/api/admin/users/${user.id}/reset-password`}
                            className="inline-form"
                            method="post"
                          >
                            <input
                              aria-label={`New password for ${user.username}`}
                              name="password"
                              placeholder="New password"
                              required
                              type="password"
                            />
                            <button className="ghost-button" type="submit">
                              Reset
                            </button>
                          </form>
                          {!user.disabledAt ? (
                            <form
                              action={`/api/admin/users/${user.id}/disable`}
                              method="post"
                            >
                              <button
                                className="danger-button"
                                disabled={user.id === session.user.id}
                                type="submit"
                              >
                                Disable
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
