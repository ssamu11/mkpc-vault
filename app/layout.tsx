import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PocaPop Vault",
  description: "PocaPop photocard catalog and pack planning workspace.",
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
