import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "The Syndicate Accord — Character Builder & Portal",
  description: "Role generation, bio crafting, and secure profile portal for Syndicate Accord participants.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
