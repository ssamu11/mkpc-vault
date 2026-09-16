import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MKPC VAULT · Moderator Workspace",
  description: "Moderator workspace for the MKPC card catalog.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
