"use client";

import React, { useRef } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { ActionButton } from "@/components/ui";

// ---- Icons for Header Actions ----
const ExportIcon = () => <span className="text-base">📤</span>;
const ImportIcon = () => <span className="text-base">📥</span>;
const ClearIcon = () => <span className="text-base">🗑️</span>;

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportCircuit = useCircuitStore((s) => s.exportCircuit);
  const importCircuit = useCircuitStore((s) => s.importCircuit);
  const clearAll = useCircuitStore((s) => s.clearAll);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        importCircuit(text);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-imported
    e.target.value = "";
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "Are you sure you want to clear the entire breadboard? This cannot be undone.",
      )
    ) {
      clearAll();
    }
  };

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

      {/* Action Buttons - Using extracted ActionButton component */}
      <div className="flex items-center gap-2">
        <ActionButton
          icon={<ExportIcon />}
          label="Export"
          onClick={exportCircuit}
          title="Export circuit as JSON file (Ctrl+S)"
        />
        <ActionButton
          icon={<ImportIcon />}
          label="Import"
          onClick={handleImportClick}
          title="Import circuit from JSON file"
        />
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <ActionButton
          icon={<ClearIcon />}
          label="Clear All"
          onClick={handleClearAll}
          variant="danger"
          title="Clear all components and wires"
        />

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </header>
  );
};

export default Header;
