import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts ship with the project, so the app works offline and Hindi renders correctly.
const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/poppins-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/poppins-latin-700-normal.woff2", weight: "700" },
  ],
});
const devanagari = localFont({
  variable: "--font-devanagari",
  src: [
    { path: "./fonts/noto-sans-devanagari-devanagari-400-normal.woff2", weight: "400" },
    { path: "./fonts/noto-sans-devanagari-devanagari-600-normal.woff2", weight: "600" },
    { path: "./fonts/noto-sans-devanagari-devanagari-700-normal.woff2", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: "ExplainIt",
  description: "Turn any topic into a short explainer video, in English or हिंदी.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f9f9ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${devanagari.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
