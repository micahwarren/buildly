import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Buildly — Your idea. A plan to build it.",
  description:
    "Upload a photo. Describe your idea. Get a DIY design, materials list, and step-by-step plan.",
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
