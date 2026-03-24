"use client";

// ============================================
// WIRE INFO PANEL
// Displays details about the selected wire
// ============================================
//
// AGENTS.md COMPLIANCE:
// - This is a "dumb" UI component - receives all data via props
// - No direct store access - uses callbacks from parent
// - Reusable and testable in isolation
// ============================================

import React from "react";
import { Wire, BreadboardNode } from "@/lib/types";

interface WireInfoPanelProps {
  wire: Wire;
  nodes: Map<string, BreadboardNode>;
  onDelete: (wireId: string) => void;
}

export const WireInfoPanel: React.FC<WireInfoPanelProps> = ({
  wire,
  nodes,
  onDelete,
}) => {
  const startNode = nodes.get(wire.startNodeId);
  const endNode = nodes.get(wire.endNodeId);

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Selected Wire</h3>
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-gray-500">Color:</span>{" "}
          <span
            className="inline-block w-4 h-4 rounded border border-gray-300 align-middle ml-1"
            style={{ backgroundColor: wire.color }}
          />
        </p>
        <p>
          <span className="text-gray-500">Start Node:</span>{" "}
          <span className="font-mono text-xs text-gray-700">
            {startNode?.id || "Unknown"}
          </span>
        </p>
        <p>
          <span className="text-gray-500">End Node:</span>{" "}
          <span className="font-mono text-xs text-gray-700">
            {endNode?.id || "Unknown"}
          </span>
        </p>
        <p>
          <span className="text-gray-500">ID:</span>{" "}
          <span className="font-mono text-xs text-gray-700">
            {wire.id.slice(0, 8)}...
          </span>
        </p>
        <button
          onClick={() => onDelete(wire.id)}
          className="mt-2 w-full px-3 py-2.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 transition-colors cursor-pointer"
        >
          Delete Wire
        </button>
      </div>
    </div>
  );
};

export default WireInfoPanel;
