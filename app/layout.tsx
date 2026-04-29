import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Powerlytics Dashboard",
  description: "Training compliance dashboard for Intervals.icu activities",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
