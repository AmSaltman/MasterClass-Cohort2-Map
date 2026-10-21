import type { Metadata, Viewport } from "next";
import { Inter_Tight, Newsreader } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const sans = Inter_Tight({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Fall '26 Cohort Map — MasterClass Executive",
  description: "Find and connect with your MasterClass Executive classmates around the world.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1c1c1c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
