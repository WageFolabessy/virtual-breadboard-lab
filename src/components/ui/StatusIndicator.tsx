"use client";

import React from "react";
import { CircuitStatus } from "@/lib/types";

// ---- Status Indicator Configuration ----
const STATUS_CONFIG: Record<
  CircuitStatus,
  { dotClass: string; textClass: string; bgClass: string; label: string }
> = {
  complete: {
    dotClass: "bg-green-500",
    textClass: "text-green-600",
    bgClass: "bg-green-100 text-green-700",
    label: "Complete Circuit",
  },
  incomplete: {
    dotClass: "bg-gray-400",
    textClass: "text-gray-500",
    bgClass: "bg-gray-100 text-gray-500",
    label: "Open Circuit",
  },
  "short-circuit": {
    dotClass: "bg-red-500 animate-pulse",
    textClass: "text-red-600",
    bgClass: "bg-red-100 text-red-700",
    label: "SHORT CIRCUIT!",
  },
};

// ---- Compact Status Indicator (for Toolbar) ----
interface StatusBadgeProps {
  status: CircuitStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm ${config.bgClass}`}
    >
      <span className={`w-3 h-3 rounded-full ${config.dotClass}`} />
      {status === "complete" && "Circuit Complete!"}
      {status === "incomplete" && "Circuit Open"}
      {status === "short-circuit" && "SHORT CIRCUIT!"}
    </div>
  );
};

// ---- Detailed Status Indicator (for Info Panel) ----
interface StatusIndicatorProps {
  status: CircuitStatus;
  message?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
}) => {
  const config = STATUS_CONFIG[status];
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-2">Status</h3>
      <div
        className={`flex items-center gap-2 text-sm font-medium ${config.textClass}`}
      >
        <span className={`w-3 h-3 rounded-full ${config.dotClass}`} />
        {config.label}
      </div>
      {message && (
        <p
          className={`mt-2 text-xs ${
            status === "short-circuit" ? "text-red-500" : "text-gray-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};
