import Link from "next/link";

import { Role } from "@prisma/client";

import type { AuthSession } from "@/lib/auth/session";

type AppShellProps = {
  session: AuthSession | null;
  children: React.ReactNode;
};

export function AppShell({ session, children }: AppShellProps) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">C</span>
          <span>
            <strong>Curly</strong>
            <small>Self-hosted cinema and anime vault</small>
          </span>
        </Link>
        <nav className="topnav">
          {session ? (
            <>
              <Link href="/">Home</Link>
              <Link href="/watch">Watch</Link>
              {session.user.role === Role.ADMIN ? <Link href="/files">Files</Link> : null}
              {session.user.role === Role.ADMIN ? <Link href="/admin/catalog">Catalog</Link> : null}
              {session.user.role === Role.ADMIN ? (
                <Link href="/admin/users">Admin</Link>
              ) : null}
              <form action="/api/auth/logout" method="post">
                <button className="ghost-button" type="submit">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <a href="#features">Features</a>
              <Link className="solid-button" href="/login">
                Login
              </Link>
            </>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}
