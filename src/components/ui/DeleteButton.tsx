"use client";

// ============================================
// DELETE BUTTON UI COMPONENT
// Convenience wrapper around PanelButton with danger variant
//
// AGENTS.md Compliance (DRY Principle):
// - Extracted from ComponentInfoPanel and WireInfoPanel
// - Now uses PanelButton internally for consistency
// ============================================

import React from "react";
import { PanelButton } from "./PanelButton";

interface DeleteButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({
  onClick,
  label,
  className = "",
}) => {
  return (
    <PanelButton
      onClick={onClick}
      label={label}
      variant="danger"
      className={className}
    />
  );
};
