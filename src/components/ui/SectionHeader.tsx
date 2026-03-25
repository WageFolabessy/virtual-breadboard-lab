"use client";

// ============================================
// SECTION HEADER UI COMPONENT
// Uppercase label for grouping sections in sidebars/panels
//
// AGENTS.md Compliance (DRY Principle):
// - Extracted from ComponentLibrary.tsx category headers
// - Reusable for any section grouping needs
// ============================================

import React from "react";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  children,
  className = "",
}) => {
  return (
    <h3
      className={`text-xs font-semibold text-gray-500 uppercase tracking-wider ${className}`}
    >
      {children}
    </h3>
  );
};
