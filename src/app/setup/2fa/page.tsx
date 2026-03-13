import Image from "next/image";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSession, isAdminReady } from "@/lib/auth/session";
import { createTotpQrDataUrl, generateTotpSecret } from "@/lib/auth/totp";
import { prisma } from "@/lib/prisma";

type TwoFactorPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  if (isAdminReady(session)) {
    redirect("/admin/security");
  }

  let totp = session.user.totpSecret;

  if (!totp) {
    const { secret } = generateTotpSecret(session.user.username);
    totp = await prisma.totpSecret.create({
      data: {
        userId: session.user.id,
        secret,
      },
    });
  }

  const otpauth = `otpauth://totp/Curly:${encodeURIComponent(session.user.username)}?secret=${totp.secret}&issuer=Curly`;
  const qrDataUrl = await createTotpQrDataUrl(otpauth);
  const error = typeof params?.error === "string" ? params.error : null;
  const success = typeof params?.success === "string" ? params.success : null;

  return (
    <AppShell session={session}>
      <main className="centered-shell">
        <section className="security-grid">
          <div className="auth-card">
            <span className="eyebrow">Admin security</span>
            <h1>Finish TOTP enrollment</h1>
            <p>
              Scan the QR code in your authenticator app, then enter the six-digit code
              to unlock Curly&apos;s admin routes.
            </p>
            {error ? <p className="alert error">{error}</p> : null}
            {success ? <p className="alert success">{success}</p> : null}
            <div className="qr-block">
              <Image alt="Curly TOTP QR code" height={280} src={qrDataUrl} width={280} />
            </div>
            <form action="/api/auth/2fa/verify" className="stack-form" method="post">
              <label>
                Verification code
                <input inputMode="numeric" name="code" pattern="[0-9]{6}" required type="text" />
              </label>
              <button className="solid-button wide" type="submit">
                Verify and unlock admin panel
              </button>
            </form>
          </div>
          <aside className="glass-card">
            <span className="eyebrow">Manual key</span>
            <code className="secret-block">{totp.secret}</code>
            <p className="muted">
              If QR scanning is unavailable, add the secret manually in your TOTP app.
            </p>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
