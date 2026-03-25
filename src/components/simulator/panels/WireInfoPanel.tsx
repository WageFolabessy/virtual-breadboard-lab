"use client";

// ============================================
// WIRE INFO PANEL
// Displays details about the selected wire
// ============================================
//
// AGENTS.md COMPLIANCE:
// - This is a "dumb" UI component - receives all data via props
// - No direct store access - uses callbacks from parent
// - Uses extracted UI components (InfoPanel, PropertyRow, DeleteButton)
// - Reusable and testable in isolation
// ============================================

import React from "react";
import { Wire, BreadboardNode } from "@/lib/types";
import { InfoPanel, PropertyRow, DeleteButton } from "@/components/ui";

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
    <InfoPanel title="Selected Wire">
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-gray-500">Color:</span>{" "}
          <span
            className="inline-block w-4 h-4 rounded border border-gray-300 align-middle ml-1"
            style={{ backgroundColor: wire.color }}
          />
        </p>
        <PropertyRow label="Start Node" value={startNode?.id || "Unknown"} />
        <PropertyRow label="End Node" value={endNode?.id || "Unknown"} />
        <PropertyRow label="ID" value={`${wire.id.slice(0, 8)}...`} />
        <DeleteButton onClick={() => onDelete(wire.id)} label="Delete Wire" />
      </div>
    </InfoPanel>
  );
};

export default WireInfoPanel;
