import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Curly",
  description:
    "Curly is a self-hosted media control panel with streaming, admin tools, and file management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
