"use client";

// ============================================
// TRANSISTOR SVG COMPONENT (NPN / PNP)
// TO-92 package with 3 dynamic leads (Collector, Base, Emitter)
// ============================================

import React from "react";
import { asTransistorState } from "@/lib/types";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

interface TransistorProps extends BaseComponentProps {
  isActive: boolean;
}

export const Transistor: React.FC<TransistorProps> = React.memo(
  ({ component, nodes, isSelected, isActive, onClick }) => {
    const state = asTransistorState(component.state);
    const isNPN = state?.type === "npn";

    // Get 3 pin positions
    const collectorPin = component.pins.find((p) => p.pinType === "collector");
    const basePin = component.pins.find((p) => p.pinType === "base");
    const emitterPin = component.pins.find((p) => p.pinType === "emitter");

    const collectorNode = collectorPin?.connectedNodeId
      ? nodes.get(collectorPin.connectedNodeId)
      : null;
    const baseNode = basePin?.connectedNodeId
      ? nodes.get(basePin.connectedNodeId)
      : null;
    const emitterNode = emitterPin?.connectedNodeId
      ? nodes.get(emitterPin.connectedNodeId)
      : null;

    if (!collectorNode || !baseNode || !emitterNode) return null;

    // Use base node as center anchor (middle pin)
    const cx = baseNode.canvasPosition.x;
    const cy = baseNode.canvasPosition.y;

    // Collector is pin[0], Base is pin[1], Emitter is pin[2]
    // They sit on consecutive columns in the same row
    const colX = collectorNode.canvasPosition.x;
    const emiX = emitterNode.canvasPosition.x;

    // TO-92 body dimensions
    const bodyRadius = 10;
    const bodyOffsetY = -16; // Body sits above the pin row

    return (
      <g
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ cursor: "pointer" }}
      >
        {/* Selection highlight */}
        {isSelected && (
          <rect
            x={colX - 6}
            y={cy + bodyOffsetY - bodyRadius - 4}
            width={emiX - colX + 12}
            height={bodyRadius * 2 + (cy - (cy + bodyOffsetY) + bodyRadius) + 8}
            fill="none"
            stroke={COLORS.SELECTION_HIGHLIGHT}
            strokeWidth={2}
            strokeDasharray="4 2"
            rx={4}
          />
        )}

        {/* Lead wires — vertical from pin holes up to body bottom */}
        {/* Collector lead (left) */}
        <line
          x1={colX}
          y1={cy}
          x2={colX}
          y2={cy + bodyOffsetY + bodyRadius}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />
        {/* Base lead (center) */}
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy + bodyOffsetY + bodyRadius}
          stroke={isActive ? "#F59E0B" : "#888"}
          strokeWidth={2}
        />
        {/* Emitter lead (right) */}
        <line
          x1={emiX}
          y1={cy}
          x2={emiX}
          y2={cy + bodyOffsetY + bodyRadius}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />

        {/* TO-92 Body — D-shape (flat bottom, rounded top) */}
        <path
          d={`
            M ${cx - bodyRadius} ${cy + bodyOffsetY + bodyRadius}
            L ${cx + bodyRadius} ${cy + bodyOffsetY + bodyRadius}
            A ${bodyRadius} ${bodyRadius} 0 0 0 ${cx - bodyRadius} ${cy + bodyOffsetY + bodyRadius}
          `}
          fill={isActive ? "#2a2a2a" : "#1a1a1a"}
          stroke={isActive ? "#4ADE80" : "#555"}
          strokeWidth={1.5}
        />

        {/* Flat face indicator (bottom line) */}
        <line
          x1={cx - bodyRadius}
          y1={cy + bodyOffsetY + bodyRadius}
          x2={cx + bodyRadius}
          y2={cy + bodyOffsetY + bodyRadius}
          stroke={isActive ? "#4ADE80" : "#777"}
          strokeWidth={2}
        />

        {/* NPN/PNP Label */}
        <text
          x={cx}
          y={cy + bodyOffsetY + 2}
          fill="#ddd"
          fontSize="6"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {isNPN ? "NPN" : "PNP"}
        </text>

        {/* Directional arrow */}
        {isNPN ? (
          // NPN: Arrow pointing OUT from base toward emitter
          <polygon
            points={`${emiX - 2},${cy + bodyOffsetY + bodyRadius - 2} ${emiX + 2},${cy + bodyOffsetY + bodyRadius + 2} ${emiX - 4},${cy + bodyOffsetY + bodyRadius + 2}`}
            fill={isActive ? "#4ADE80" : "#999"}
          />
        ) : (
          // PNP: Arrow pointing IN toward base from emitter
          <polygon
            points={`${emiX - 2},${cy + bodyOffsetY + bodyRadius + 2} ${emiX + 2},${cy + bodyOffsetY + bodyRadius - 2} ${emiX + 4},${cy + bodyOffsetY + bodyRadius + 2}`}
            fill={isActive ? "#4ADE80" : "#999"}
          />
        )}

        {/* Pin labels */}
        <text x={colX} y={cy + 8} fill="#999" fontSize="5" textAnchor="middle">
          C
        </text>
        <text x={cx} y={cy + 8} fill="#D97706" fontSize="5" textAnchor="middle">
          B
        </text>
        <text x={emiX} y={cy + 8} fill="#999" fontSize="5" textAnchor="middle">
          E
        </text>

        {/* Active glow */}
        {isActive && (
          <circle
            cx={cx}
            cy={cy + bodyOffsetY}
            r={bodyRadius + 3}
            fill="none"
            stroke="rgba(74, 222, 128, 0.3)"
            strokeWidth={2}
            style={{ filter: "blur(3px)" }}
          />
        )}
      </g>
    );
  },
  areComponentPropsEqual<TransistorProps>(["isActive"]),
);

Transistor.displayName = "Transistor";

export default Transistor;
