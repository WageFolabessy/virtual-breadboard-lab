import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <div>
        <h1
          className="text-xl font-bold text-gray-900 tracking-tight"
          title="A fast, interactive, and purely logic-based web application for safely designing and testing basic electronic circuits without physical components."
        >
          Virtual Breadboard Lab (VBL)
        </h1>
        <p className="text-sm text-gray-500 hidden md:block mt-0.5">
          A fast, interactive, and purely logic-based web application for safely
          designing and testing basic electronic circuits without physical
          components.
        </p>
      </div>
    </header>
  );
};

export default Header;
