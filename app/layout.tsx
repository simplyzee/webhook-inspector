import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Webhook Inspector",
  description: "Capture, inspect and replay webhooks. Forward them to localhost with one command.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
