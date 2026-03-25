import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 px-4 py-1.5 text-center text-xs text-gray-500 shrink-0">
      &copy; {new Date().getFullYear()} Virtual Breadboard Lab. Powered by{" "}
      <a
        href="https://cangkir.tech"
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-black hover:underline transition-colors"
      >
        Cangkir
      </a>
    </footer>
  );
};

export default Footer;
