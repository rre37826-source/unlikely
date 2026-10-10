import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unlikely — Trial status",
  description: "Availability of the Unlikely public trial. Return to Unlikely to explore your ideas.",
  robots: { index: false, follow: false },
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
