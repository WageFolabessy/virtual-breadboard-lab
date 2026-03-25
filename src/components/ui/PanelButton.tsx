"use client";

// ============================================
// PANEL BUTTON UI COMPONENT
// Reusable full-width button with variants for info panels
//
// AGENTS.md Compliance (DRY Principle):
// - Generalizes DeleteButton pattern with multiple variants
// - Single source of truth for panel button styling
// - Replaces inline buttons in ComponentInfoPanel toggle, etc.
// ============================================

import React from "react";

export type PanelButtonVariant = "danger" | "primary" | "default";

interface PanelButtonProps {
  onClick: () => void;
  label: string;
  variant?: PanelButtonVariant;
  className?: string;
}

const VARIANT_STYLES: Record<PanelButtonVariant, string> = {
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
  primary: "bg-blue-50 text-blue-600 hover:bg-blue-100",
  default: "bg-gray-50 text-gray-700 hover:bg-gray-100",
};

export const PanelButton: React.FC<PanelButtonProps> = ({
  onClick,
  label,
  variant = "default",
  className = "",
}) => {
  return (
    <button
      onClick={onClick}
      className={`mt-2 w-full px-3 py-2.5 text-sm rounded transition-colors cursor-pointer ${VARIANT_STYLES[variant]} ${className}`}
    >
      {label}
    </button>
  );
};
