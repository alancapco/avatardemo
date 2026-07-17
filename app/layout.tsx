import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

/* Montserrat is the closest widely licensed stand-in for Capco’s Gotham. */
const gotham = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-gotham",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Capco | LiveAvatar Interviews",
  description:
    "Capco LiveAvatar video interview platform for hiring — create interviews, share links, and review scored insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={gotham.variable}>
      <body>{children}</body>
    </html>
  );
}
