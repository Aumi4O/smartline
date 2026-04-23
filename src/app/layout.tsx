import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartLine — AI Voice Agents for Business",
  description: "Deploy intelligent voice agents that answer calls, book appointments, and handle customer inquiries 24/7.",
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
