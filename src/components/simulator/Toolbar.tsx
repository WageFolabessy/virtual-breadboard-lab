"use client";

// ============================================
// TOOLBAR COMPONENT
// Top toolbar with tool selection and actions
// ============================================

import React, { useEffect } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { ToolType } from "@/lib/types";
import { SHORTCUTS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui";

interface ToolButtonProps {
  tool: ToolType;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  isActive: boolean;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  icon,
  label,
  shortcut,
  isActive,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      title={`${label} (${shortcut.toUpperCase()})`}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-150
        ${
          isActive
            ? "bg-blue-500 text-white shadow-md"
            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      <kbd
        className={`
          text-xs px-1.5 py-0.5 rounded
          ${isActive ? "bg-blue-600 text-blue-100" : "bg-gray-100 text-gray-500"}
        `}
      >
        {shortcut.toUpperCase()}
      </kbd>
    </button>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onClick,
  variant = "default",
}) => {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-150
        ${
          variant === "danger"
            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

// ---- Icons ----
const SelectIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
    />
  </svg>
);

const WireIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

const DeleteIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ClearIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export const Toolbar: React.FC = () => {
  const { selectedTool, setSelectedTool, clearAll, simulation } =
    useCircuitStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case SHORTCUTS.SELECT_TOOL:
          setSelectedTool("select");
          break;
        case SHORTCUTS.WIRE_TOOL:
          setSelectedTool("wire");
          break;
        case SHORTCUTS.DELETE_TOOL:
          setSelectedTool("delete");
          break;
        case SHORTCUTS.ESCAPE:
          setSelectedTool("select");
          useCircuitStore.getState().cancelWire();
          useCircuitStore.getState().cancelComponentPlacement();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedTool]);

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Tools */}
        <div className="flex items-center gap-2">
          <ToolButton
            tool="select"
            icon={<SelectIcon />}
            label="Select"
            shortcut={SHORTCUTS.SELECT_TOOL}
            isActive={selectedTool === "select"}
            onClick={() => setSelectedTool("select")}
          />
          <ToolButton
            tool="wire"
            icon={<WireIcon />}
            label="Wire"
            shortcut={SHORTCUTS.WIRE_TOOL}
            isActive={selectedTool === "wire"}
            onClick={() => setSelectedTool("wire")}
          />
          <ToolButton
            tool="delete"
            icon={<DeleteIcon />}
            label="Delete"
            shortcut={SHORTCUTS.DELETE_TOOL}
            isActive={selectedTool === "delete"}
            onClick={() => setSelectedTool("delete")}
          />
        </div>

        {/* Center - Circuit Status */}
        <div className="flex items-center gap-3">
          <StatusBadge status={simulation.status} />
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          <ActionButton
            icon={<ClearIcon />}
            label="Clear All"
            onClick={clearAll}
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
