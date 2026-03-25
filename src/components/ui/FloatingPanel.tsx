"use client";

// ============================================
// FLOATING PANEL UI COMPONENT
// Glassmorphic floating container for canvas overlays
//
// AGENTS.md Compliance (DRY Principle):
// - Extracted from Workspace.tsx zoom controls and info bar
// - Consistent styling for all floating canvas elements
// ============================================

import React from "react";

export type FloatingPanelPosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

interface FloatingPanelProps {
  position: FloatingPanelPosition;
  children: React.ReactNode;
  className?: string;
}

const POSITION_STYLES: Record<FloatingPanelPosition, string> = {
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
};

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  position,
  children,
  className = "",
}) => {
  return (
    <div
      className={`
        absolute ${POSITION_STYLES[position]}
        flex items-center gap-1
        bg-white/90 backdrop-blur-sm
        border border-gray-300 rounded-lg shadow-lg
        px-2 py-1.5 select-none
        ${className}
      `}
    >
      {children}
    </div>
  );
};
