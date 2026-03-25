"use client";

// ============================================
// ACTION BUTTON UI COMPONENT
// Reusable button with icon and label for toolbar/header actions
//
// AGENTS.md Compliance (DRY Principle):
// - Extracted from Toolbar.tsx for reuse in Header.tsx
// - Single source of truth for action button styling
// ============================================

import React from "react";

export type ActionButtonVariant = "default" | "danger" | "primary";

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: ActionButtonVariant;
  title?: string;
  className?: string;
}

const VARIANT_STYLES: Record<ActionButtonVariant, string> = {
  default: "bg-white text-gray-700 hover:bg-gray-100 border-gray-200",
  danger: "bg-red-50 text-red-600 hover:bg-red-100 border-red-200",
  primary: "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200",
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onClick,
  variant = "default",
  title,
  className = "",
}) => {
  return (
    <button
      onClick={onClick}
      title={title || label}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer
        hover:scale-[1.02] border
        ${VARIANT_STYLES[variant]}
        ${className}
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};
