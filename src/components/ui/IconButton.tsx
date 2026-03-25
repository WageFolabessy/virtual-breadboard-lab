"use client";

// ============================================
// ICON BUTTON UI COMPONENT
// Square icon-only button for compact controls (zoom, etc.)
//
// AGENTS.md Compliance (DRY Principle):
// - Extracted from Workspace.tsx zoom controls
// - Reusable for any icon-only button needs
// ============================================

import React from "react";

export type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  size?: IconButtonSize;
  className?: string;
}

const SIZE_STYLES: Record<IconButtonSize, string> = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-lg",
  lg: "w-12 h-12 text-xl",
};

export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  title,
  children,
  size = "md",
  className = "",
}) => {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        flex items-center justify-center rounded-md
        hover:bg-gray-100 active:bg-gray-200
        text-gray-700 font-bold transition-colors cursor-pointer
        ${SIZE_STYLES[size]}
        ${className}
      `}
    >
      {children}
    </button>
  );
};
