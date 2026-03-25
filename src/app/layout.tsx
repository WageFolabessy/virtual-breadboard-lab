import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  getSoftwareApplicationSchema,
  getFAQPageSchema,
  getOrganizationSchema,
} from "@/lib/seo/structured-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Enhanced SEO Metadata (Phase 1: Foundation)
 * - Bilingual support (English + Bahasa Indonesia)
 * - Optimized for global + Indonesian search queries
 * - Rich Open Graph + Twitter Card data
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://vbl.eproject.tech"),
  title: {
    default:
      "Virtual Breadboard Lab - Free Online Circuit Simulator | Simulator Elektronika Gratis",
    template: "%s | Virtual Breadboard Lab",
  },
  description:
    "Free interactive breadboard simulator. Design, test, and learn electronic circuits, logic gates, and 555 Timer ICs directly in your browser. No installation required. / Simulator elektronika online gratis dari Cangkir untuk belajar sirkuit digital dan IC Timer 555.",
  keywords: [
    // English (Global SEO)
    "free online circuit simulator",
    "virtual breadboard",
    "breadboard simulator",
    "circuit design tool",
    "logic gate simulator",
    "555 timer simulator online",
    "electronics learning tool",
    "online electronics lab",
    "circuit simulator web app",
    "breadboard wiring simulator",
    "transistor simulator",
    "LED circuit simulator",
    // Indonesian (Local SEO)
    "simulator elektronika gratis",
    "belajar sirkuit online",
    "merakit sirkuit gratis",
    "simulator breadboard indonesia",
    "alat belajar elektronika",
    "transistor NPN PNP simulator",
    "IC Timer 555 online",
    "gerbang logika simulator",
    "Cangkir",
  ],
  authors: [{ name: "Cangkir", url: "https://eproject.tech" }],
  creator: "Cangkir",
  publisher: "Cangkir",
  category: "Educational Technology",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["id_ID"],
    url: "https://vbl.eproject.tech",
    siteName: "Virtual Breadboard Lab",
    title:
      "Virtual Breadboard Lab - Free Online Circuit Simulator | Simulator Elektronika Gratis",
    description:
      "Free interactive breadboard simulator. Design, test, and learn electronic circuits, logic gates, and 555 Timer ICs directly in your browser. No installation required. / Simulator elektronika online gratis dari Cangkir.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Virtual Breadboard Lab - Online Circuit Simulator Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Virtual Breadboard Lab - Free Online Circuit Simulator | Simulator Elektronika Gratis",
    description:
      "Design, test, and learn electronic circuits directly in your browser. No installation required. / Simulator elektronika online gratis dari Cangkir.",
    images: ["/icon.png"],
    creator: "@cangkir_tech",
    site: "@cangkir_tech",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://vbl.eproject.tech",
  },
  verification: {
    // Add these when you verify with Google/Bing Search Console
    // google: 'YOUR_GOOGLE_VERIFICATION_CODE',
    // bing: 'YOUR_BING_VERIFICATION_CODE',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Generate structured data schemas for Google Rich Results
  const softwareAppSchema = getSoftwareApplicationSchema();
  const faqSchema = getFAQPageSchema();
  const orgSchema = getOrganizationSchema();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Schema.org JSON-LD for Rich Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareAppSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
