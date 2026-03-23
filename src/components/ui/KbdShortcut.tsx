"use client";

import React from "react";

interface KbdShortcutProps {
  shortcut: string;
  label: string;
}

/**
 * Displays a keyboard shortcut hint: "Press [KEY] Label"
 */
export const KbdShortcut: React.FC<KbdShortcutProps> = ({
  shortcut,
  label,
}) => {
  return (
    <span>
      Press{" "}
      <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
        {shortcut}
      </kbd>{" "}
      {label}
    </span>
  );
};
