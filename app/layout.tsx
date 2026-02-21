import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentBuilder",
  description: "Multi-agent collaborative document editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
