import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vbl.cangkir.tech"),
  title:
    "Virtual Breadboard Lab - Free Online Circuit Simulator | Simulator Elektronika",
  description:
    "Free interactive breadboard simulator. Design, test, and learn electronic circuits, logic gates, and 555 Timer ICs directly in your browser. / Simulator elektronika online gratis dari Cangkir.",
  keywords: [
    "free online circuit simulator",
    "virtual breadboard",
    "logic gate simulator",
    "555 timer simulator online",
    "electronics learning tool",
    "breadboard simulator",
    "circuit simulator",
    "simulator elektronika",
    "belajar sirkuit",
    "merakit sirkuit gratis",
    "transistor NPN PNP",
    "IC Timer 555",
    "Cangkir",
  ],
  authors: [{ name: "Cangkir", url: "https://cangkir.tech" }],
  creator: "Cangkir",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://vbl.cangkir.tech",
    siteName: "Virtual Breadboard Lab",
    title:
      "Virtual Breadboard Lab - Free Online Circuit Simulator | Simulator Elektronika",
    description:
      "Free interactive breadboard simulator. Design, test, and learn electronic circuits, logic gates, and 555 Timer ICs directly in your browser. / Simulator elektronika online gratis dari Cangkir.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Virtual Breadboard Lab Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Virtual Breadboard Lab - Free Online Circuit Simulator",
    description:
      "Free interactive breadboard simulator. Design, test, and learn electronic circuits directly in your browser. / Simulator elektronika online gratis.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
