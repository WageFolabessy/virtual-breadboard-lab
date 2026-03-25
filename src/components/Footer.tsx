import React from "react";

// ============================================
// FOOTER COMPONENT
// Contains copyright, attribution, and SEO-semantic content
// ============================================
//
// AGENTS.md COMPLIANCE:
// - Pure "dumb" UI component — no store access, no business logic
// - SEO: sr-only sections inject bilingual keyword-rich semantic text for crawlers
// ============================================

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 shrink-0">
      {/* SEO: Bilingual semantic content for search engine crawlers */}
      {/* Visually hidden but fully readable in DOM */}
      <section className="sr-only" aria-label="About Virtual Breadboard Lab">
        <h2>Fitur Simulator Elektronika</h2>
        <p>
          Virtual Breadboard Lab (VBL) adalah simulator elektronika online
          gratis dari Cangkir. Rancang dan uji sirkuit elektronika langsung dari
          browser Anda tanpa komponen fisik. Pelajari cara merakit sirkuit
          dengan LED, resistor, kapasitor, buzzer, dioda, transistor NPN dan
          PNP, saklar, serta IC Timer 555. Simulator breadboard interaktif ini
          menggunakan pendekatan gerbang logika dasar untuk mengevaluasi
          rangkaian secara real-time — belajar elektronika tanpa risiko
          korsleting.
        </p>

        <h2>Free Online Breadboard Simulator</h2>
        <p>
          Virtual Breadboard Lab (VBL) by Cangkir is a free, browser-based
          electronic circuit simulator. Build and test digital logic gates,
          NPN/PNP transistors, and 555 timer oscillators without physical
          components. Perfect for engineering students and hobbyists learning
          circuit design fundamentals safely — no short circuits, no burnt
          components.
        </p>
      </section>

      {/* Visible copyright + attribution */}
      <div className="px-4 py-1.5 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Virtual Breadboard Lab. Powered by{" "}
        <a
          href="https://eproject.tech"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-black hover:underline transition-colors"
        >
          Cangkir
        </a>
      </div>
    </footer>
  );
};

export default Footer;
