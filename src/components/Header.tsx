"use client";

import React, { useRef, useState, useCallback } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { useShallow } from "zustand/react/shallow";
import { ActionButton } from "@/components/ui";
import { STORAGE_KEYS } from "@/lib/constants";

// ---- Icons for Header Actions ----
const ExportIcon = () => <span className="text-base">📤</span>;
const ImportIcon = () => <span className="text-base">📥</span>;
const ClearIcon = () => <span className="text-base">🗑️</span>;
const CopyIcon = () => <span className="text-base">📋</span>;
const PasteIcon = () => <span className="text-base">📄</span>;
const CheckIcon = () => <span className="text-base">✓</span>;
const HelpIcon = () => <span className="text-base">❓</span>;

import Image from "next/image";
import logo from "@/app/icon.png";

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  // AGENTS.MD COMPLIANCE: Use useShallow for consistency (functions have stable refs, but this maintains pattern consistency)
  const { exportCircuit, importCircuit, clearAll, copyCircuitToClipboard, pasteCircuitFromClipboard } = useCircuitStore(
    useShallow((state) => ({
      exportCircuit: state.exportCircuit,
      importCircuit: state.importCircuit,
      clearAll: state.clearAll,
      copyCircuitToClipboard: state.copyCircuitToClipboard,
      pasteCircuitFromClipboard: state.pasteCircuitFromClipboard,
    })),
  );

  // Help button handler: Reset localStorage flag and trigger tour via store
  const handleHelpClick = useCallback(() => {
    // Reset the "seen" flag so tour shows all steps
    try {
      localStorage.removeItem(STORAGE_KEYS.ONBOARDING_SEEN);
    } catch (e) {
      console.warn("[VBL] Failed to reset onboarding state:", e);
    }
    // Trigger tour via stable store action reference
    useCircuitStore.getState().startTour();
  }, []);

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

  // ---- Clipboard Handlers with Visual Feedback ----
  const handleCopyToClipboard = useCallback(async () => {
    const success = await copyCircuitToClipboard();
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      alert("Failed to copy circuit to clipboard.");
    }
  }, [copyCircuitToClipboard]);

  const handlePasteFromClipboard = useCallback(async () => {
    const success = await pasteCircuitFromClipboard();
    if (!success) {
      alert("Invalid VBL JSON format. Paste failed.");
    }
  }, [pasteCircuitFromClipboard]);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Image
          src={logo}
          alt="Virtual Breadboard Lab Logo"
          width={70}
          height={70}
          className="w-[70px] h-[70px] rounded-lg shadow-sm"
          priority
        />
        <div>
          <h1
            className="text-xl font-bold text-gray-900 tracking-tight"
            title="A fast, interactive, and purely logic-based web application for safely designing and testing basic electronic circuits without physical components."
          >
            Virtual Breadboard Lab
          </h1>
          <p className="text-sm text-gray-500 hidden md:block mt-0.5">
            A fast, interactive, and purely logic-based web application for
            safely designing and testing basic electronic circuits without
            physical components.
          </p>
        </div>
      </div>

      {/* Action Buttons - Using extracted ActionButton component */}
      <div className="flex items-center gap-2">
        {/* Clipboard Actions */}
        <ActionButton
          icon={isCopied ? <CheckIcon /> : <CopyIcon />}
          label={isCopied ? "Copied!" : "Copy JSON"}
          onClick={handleCopyToClipboard}
          title="Copy circuit to clipboard (Ctrl+C)"
          className={isCopied ? "text-green-600" : ""}
        />
        <ActionButton
          icon={<PasteIcon />}
          label="Paste JSON"
          onClick={handlePasteFromClipboard}
          title="Paste circuit from clipboard (Ctrl+V)"
        />
        <div className="w-px h-6 bg-gray-300 mx-1" />
        {/* File-based Actions */}
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
          icon={<HelpIcon />}
          label="Help"
          onClick={handleHelpClick}
          title="Restart onboarding tour"
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
