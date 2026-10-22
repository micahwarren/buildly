import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Buildly — See it. Plan it. Build it.",
  description:
    "Turn your backyard idea into a project you can picture and plan.",
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
