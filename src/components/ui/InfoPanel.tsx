"use client";

// ============================================
// INFO PANEL UI COMPONENT
// Reusable panel container for info displays
//
// AGENTS.md Compliance (DRY Principle):
// - Extracted from ComponentInfoPanel, WireInfoPanel, StatusIndicator
// - Single source of truth for panel container styling
// ============================================

import React from "react";

interface InfoPanelProps {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "info";
  className?: string;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  title,
  children,
  variant = "default",
  className = "",
}) => {
  const variantStyles = {
    default: "bg-white border-gray-200",
    info: "bg-blue-50 border-blue-200",
  };

  return (
    <div
      className={`rounded-lg p-4 border mb-4 ${variantStyles[variant]} ${className}`}
    >
      <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>
      {children}
    </div>
  );
};

// ---- Panel Title Component (for standalone use) ----
interface PanelTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const PanelTitle: React.FC<PanelTitleProps> = ({
  children,
  className = "",
}) => {
  return (
    <h3 className={`text-sm font-semibold text-gray-600 mb-3 ${className}`}>
      {children}
    </h3>
  );
};

// ---- Property Row Component (for label: value displays) ----
interface PropertyRowProps {
  label: string;
  value: React.ReactNode;
  monospace?: boolean;
}

export const PropertyRow: React.FC<PropertyRowProps> = ({
  label,
  value,
  monospace = true,
}) => {
  return (
    <p>
      <span className="text-gray-500">{label}:</span>{" "}
      <span className={monospace ? "font-mono text-xs text-gray-700" : ""}>
        {value}
      </span>
    </p>
  );
};
