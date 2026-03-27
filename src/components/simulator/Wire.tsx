"use client";

// ============================================
// WIRE SVG COMPONENT
// Renders wires connecting breadboard nodes
// ============================================
//
// VISUAL SEMANTICS:
// Wire color is ALWAYS the user's chosen color (wire.color).
// Wire insulation does not change color with current flow.
// Active circuit feedback comes from LED glow and status badge.
//
// INTERACTION:
// - Select tool: Click to select wire (show info in sidebar)
// - Delete tool: Click to delete wire immediately
// - Selected wires show visual highlight (glow effect)
// ============================================

import React from "react";
import { Wire as WireType, BreadboardNode, ToolType } from "@/lib/types";
import { RENDER } from "@/lib/constants";

interface WireProps {
  wire: WireType;
  nodes: Map<string, BreadboardNode>;
  isActive: boolean;
  isSelected: boolean;
  isMoving: boolean; // True when this wire's endpoint is being dragged
  selectedTool: ToolType;
  onSelect: (wireId: string) => void;
  onDelete: (wireId: string) => void;
  onStartMoveEndpoint: (wireId: string, endpoint: "start" | "end") => void;
}

export const Wire: React.FC<WireProps> = React.memo(
  ({
    wire,
    nodes,
    isActive,
    isSelected,
    isMoving,
    selectedTool,
    onSelect,
    onDelete,
    onStartMoveEndpoint,
  }) => {
    const startNode = nodes.get(wire.startNodeId);
    const endNode = nodes.get(wire.endNodeId);

    if (!startNode || !endNode) return null;

    const x1 = startNode.canvasPosition.x;
    const y1 = startNode.canvasPosition.y;
    const x2 = endNode.canvasPosition.x;
    const y2 = endNode.canvasPosition.y;

    // Calculate control points for a subtle curve
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Add slight curve based on wire direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Curve amount proportional to distance
    const curveAmount = Math.min(distance * 0.15, 20);

    // Perpendicular offset for curve
    const perpX = (-dy / distance) * curveAmount;
    const perpY = (dx / distance) * curveAmount;

    const controlX = midX + perpX;
    const controlY = midY + perpY;

    // Path for curved wire
    const pathD = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;

    // FIXED: Wire ALWAYS uses its assigned color - no conditional override
    // Active state is shown via subtle glow effect, not color change
    const wireColor = wire.color;

    // Handle click based on current tool
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();

      if (selectedTool === "delete") {
        // Delete tool: immediately remove wire
        onDelete(wire.id);
      } else {
        // Select tool (or any other tool): select the wire
        onSelect(wire.id);
      }
    };

    // Wire opacity: hidden when being moved, 0.7 default, 1.0 when selected
    const wireOpacity = isMoving ? 0.15 : isSelected ? 1.0 : 0.7;

    return (
      <g
        className="wire-group"
        opacity={wireOpacity}
        style={{
          transition: "opacity 0.15s ease",
        }}
      >
        {/* Wire shadow */}
        <path
          d={pathD}
          fill="none"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={RENDER.WIRE_WIDTH + 2}
          strokeLinecap="round"
          transform="translate(1, 1)"
        />

        {/* Selection highlight (blue glow when selected) */}
        {isSelected && (
          <path
            d={pathD}
            fill="none"
            stroke="rgba(59, 130, 246, 0.6)"
            strokeWidth={RENDER.WIRE_WIDTH + 6}
            strokeLinecap="round"
            opacity={0.8}
            style={{
              filter: "blur(3px)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        )}

        {/* Active glow effect (subtle, does not change wire color) */}
        {isActive && !isSelected && (
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={RENDER.WIRE_WIDTH + 4}
            strokeLinecap="round"
            opacity={0.5}
          />
        )}

        {/* Main wire — ALWAYS uses user's chosen color, thicker when selected */}
        <path
          d={pathD}
          fill="none"
          stroke={wireColor}
          strokeWidth={isSelected ? RENDER.WIRE_WIDTH + 1 : RENDER.WIRE_WIDTH}
          strokeLinecap="round"
        />

        {/* Invisible wider path for easier click detection + hover opacity boost */}
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={RENDER.WIRE_WIDTH + 10}
          strokeLinecap="round"
          style={{ cursor: "pointer" }}
          onClick={handleClick}
          onMouseEnter={(e) => {
            // Boost opacity on hover via parent group
            const group = (e.currentTarget as SVGElement).parentElement;
            if (group) group.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            // Restore default opacity (unless selected)
            const group = (e.currentTarget as SVGElement).parentElement;
            if (group && !isSelected) group.style.opacity = String(wireOpacity);
          }}
        />

        {/* Wire endpoints — ALWAYS use wire's color, larger when selected */}
        <circle cx={x1} cy={y1} r={isSelected ? 4 : 3} fill={wireColor} />
        <circle cx={x2} cy={y2} r={isSelected ? 4 : 3} fill={wireColor} />

        {/* Drag handles for endpoint relocation (only in select tool, invisible larger hit area) */}
        {selectedTool === "select" && !isMoving && (
          <>
            <circle
              cx={x1}
              cy={y1}
              r={10}
              fill="transparent"
              style={{ cursor: "grab" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartMoveEndpoint(wire.id, "start");
              }}
            />
            <circle
              cx={x2}
              cy={y2}
              r={10}
              fill="transparent"
              style={{ cursor: "grab" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartMoveEndpoint(wire.id, "end");
              }}
            />
          </>
        )}
      </g>
    );
  },
);

Wire.displayName = "Wire";

// ---- Wire Preview Component (for drawing new wires) ----
interface WirePreviewProps {
  startNode: BreadboardNode;
  currentX: number;
  currentY: number;
  color: string;
}

export const WirePreview: React.FC<WirePreviewProps> = ({
  startNode,
  currentX,
  currentY,
  color,
}) => {
  const x1 = startNode.canvasPosition.x;
  const y1 = startNode.canvasPosition.y;

  return (
    <g className="wire-preview" pointerEvents="none">
      {/* Dashed preview line */}
      <line
        x1={x1}
        y1={y1}
        x2={currentX}
        y2={currentY}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="5 5"
        opacity={0.7}
      />

      {/* Start point indicator */}
      <circle cx={x1} cy={y1} r={5} fill={color} opacity={0.7} />

      {/* End point indicator */}
      <circle cx={currentX} cy={currentY} r={4} fill={color} opacity={0.5} />
    </g>
  );
};

export default Wire;
