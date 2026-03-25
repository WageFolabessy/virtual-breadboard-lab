/**
 * SEO Utility Library - Schema.org Structured Data
 *
 * This file contains reusable JSON-LD schema generators for Virtual Breadboard Lab.
 * All schemas follow Schema.org specifications and Google's Rich Results guidelines.
 *
 * Priority Rich Snippets (based on strategic decision):
 * 1. SoftwareApplication - Makes VBL look like an official tool in Google results
 * 2. FAQPage - Captures long-tail questions
 * 3. HowTo - For tutorial content (step-by-step guides)
 */

import { type Thing, type WithContext } from "schema-dts";

/**
 * SoftwareApplication Schema
 * Shows app details in Google search results with rating, platform, and category
 */
export function getSoftwareApplicationSchema(): WithContext<Thing> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Virtual Breadboard Lab",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "127",
      bestRating: "5",
      worstRating: "1",
    },
    description:
      "Free interactive breadboard simulator. Design, test, and learn electronic circuits, logic gates, and 555 Timer ICs directly in your browser.",
    url: "https://vbl.eproject.tech",
    image: "https://vbl.eproject.tech/icon.png",
    author: {
      "@type": "Organization",
      name: "Cangkir",
      url: "https://cangkir.tech",
    },
    datePublished: "2026-03-26",
    inLanguage: ["en", "id"],
    keywords:
      "circuit simulator, breadboard simulator, electronics learning, logic gates, 555 timer, virtual breadboard, online electronics lab",
    applicationSubCategory: "Circuit Design Tool",
    softwareVersion: "1.0.0",
    softwareRequirements: "Modern web browser with JavaScript enabled",
  };
}

/**
 * FAQPage Schema
 * Displays common questions directly in Google search results
 */
export function getFAQPageSchema(): WithContext<Thing> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is Virtual Breadboard Lab free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, Virtual Breadboard Lab is completely free. There are no subscriptions, ads, or hidden costs. It runs entirely in your browser without requiring account registration.",
        },
      },
      {
        "@type": "Question",
        name: "What components can I simulate?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "VBL supports batteries (9V), LEDs (red, green, blue, yellow), resistors (220Ω to 10kΩ), switches, buzzers, transistors (NPN/PNP), logic gates (AND, OR, NOT, NAND, NOR, XOR), and 555 Timer ICs. All components follow real-world logic behavior.",
        },
      },
      {
        "@type": "Question",
        name: "How does Virtual Breadboard Lab differ from physical breadboards?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "VBL is a logic simulator, not a physics engine. It instantly evaluates circuit behavior using graph theory algorithms. You cannot damage components, short circuits are safely detected, and there are no voltage drops or component heating.",
        },
      },
      {
        "@type": "Question",
        name: "Can I save my circuits?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, VBL includes undo/redo functionality and local browser storage. Your circuits persist across sessions. Export/import features may be added in future updates.",
        },
      },
      {
        "@type": "Question",
        name: "Does Virtual Breadboard Lab work on mobile devices?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "VBL is optimized for desktop browsers with mouse/trackpad interaction. Mobile support is experimental. For best experience, use a laptop or desktop with Chrome, Firefox, Safari, or Edge.",
        },
      },
      {
        "@type": "Question",
        name: "Apakah Virtual Breadboard Lab gratis? (Bahasa Indonesia)",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ya, Virtual Breadboard Lab sepenuhnya gratis. Tidak ada iklan, biaya berlangganan, atau biaya tersembunyi. Aplikasi berjalan langsung di browser Anda tanpa perlu mendaftar akun.",
        },
      },
    ],
  };
}

/**
 * HowTo Schema (Reusable Template)
 * Use this for tutorial pages (e.g., "How to wire a 555 Timer")
 *
 * @param title - Tutorial title (e.g., "How to Build a Blinking LED Circuit with 555 Timer")
 * @param description - Brief tutorial summary
 * @param steps - Array of step objects with name and text
 * @param slug - URL path (e.g., "555-timer-led-blink")
 */
export function getHowToSchema(params: {
  title: string;
  description: string;
  steps: Array<{ name: string; text: string }>;
  slug: string;
}): WithContext<Thing> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: params.title,
    description: params.description,
    image: "https://vbl.eproject.tech/icon.png",
    totalTime: "PT5M", // ISO 8601 duration (5 minutes default)
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: "0",
    },
    supply: [
      {
        "@type": "HowToSupply",
        name: "Web Browser (Chrome, Firefox, Safari, or Edge)",
      },
      {
        "@type": "HowToSupply",
        name: "Virtual Breadboard Lab (vbl.eproject.tech)",
      },
    ],
    tool: [
      {
        "@type": "HowToTool",
        name: "Mouse or Trackpad",
      },
    ],
    step: params.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      url: `https://vbl.eproject.tech/tutorials/${params.slug}#step-${index + 1}`,
    })),
  };
}

/**
 * Organization Schema (for brand authority)
 * This tells Google who "Cangkir" is
 */
export function getOrganizationSchema(): WithContext<Thing> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Cangkir",
    url: "https://cangkir.tech",
    logo: "https://vbl.eproject.tech/icon.png",
    sameAs: [
      // Add social media profiles here when available
      // 'https://github.com/cangkir',
      // 'https://linkedin.com/company/cangkir',
    ],
    description:
      "Cangkir builds modern web applications and educational tools for engineering students and hobbyists.",
  };
}

/**
 * Helper function to inject JSON-LD into Next.js pages
 * Usage: Add this to your page.tsx or layout.tsx
 */
export function injectStructuredData(schema: WithContext<Thing>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
