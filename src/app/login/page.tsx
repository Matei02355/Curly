import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  if (session) {
    redirect("/");
  }

  const error = typeof params?.error === "string" ? params.error : null;
  const message = typeof params?.message === "string" ? params.message : null;

  return (
    <AppShell session={null}>
      <main className="centered-shell">
        <section className="auth-card">
          <span className="eyebrow">Sign in</span>
          <h1>Access your Curly panel</h1>
          <p>
            Viewers can stream immediately. Admins continue into TOTP verification after
            the password step.
          </p>
          {error ? <p className="alert error">{error}</p> : null}
          {message ? <p className="alert success">{message}</p> : null}
          <form action="/api/auth/login" className="stack-form" method="post">
            <label>
              Username
              <input autoComplete="username" name="username" required type="text" />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                name="password"
                required
                type="password"
              />
            </label>
            <button className="solid-button wide" type="submit">
              Continue
            </button>
          </form>
          <small className="muted">
            First admin sign-in lands on <code>/setup/2fa</code> until TOTP is enrolled.
          </small>
          <Link className="inline-link" href="/">
            Back to landing page
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
