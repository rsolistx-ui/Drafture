import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getdrafture.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Drafture | Your voice, before 11:59 PM.",
    template: "%s · Drafture",
  },
  description:
    "Drafture is a writing coach for college students. Paste the prompt and your notes, get a first draft in your voice before the deadline, then edit it into work that's yours.",
  keywords: [
    "writing coach",
    "discussion post",
    "college essay help",
    "AI writing assistant",
    "first draft generator",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Drafture | Your voice, before 11:59 PM.",
    description:
      "Paste the prompt. Get a first draft in your voice. Edit and submit work that is yours, before the deadline.",
    siteName: "Drafture",
  },
  twitter: {
    card: "summary_large_image",
    title: "Drafture | Your voice, before 11:59 PM.",
    description:
      "Paste the prompt. Get a first draft in your voice. Edit and submit work that is yours, before the deadline.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white" suppressHydrationWarning>{children}</body>
    </html>
  );
}
