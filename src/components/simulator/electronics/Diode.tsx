"use client";

// ============================================
// DIODE SVG COMPONENT
// Standard signal diode — allows current in one direction
// Dynamic leads stretch from body edge to pin positions
// ============================================

import React from "react";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

interface DiodeProps extends BaseComponentProps {
  isActive: boolean;
}

export const Diode: React.FC<DiodeProps> = React.memo(
  ({ component, nodes, isSelected, isActive, onClick }) => {
    // Get pin positions
    const anodePin = component.pins.find((p) => p.pinType === "anode");
    const cathodePin = component.pins.find((p) => p.pinType === "cathode");

    const anodeNode = anodePin?.connectedNodeId
      ? nodes.get(anodePin.connectedNodeId)
      : null;
    const cathodeNode = cathodePin?.connectedNodeId
      ? nodes.get(cathodePin.connectedNodeId)
      : null;

    if (!anodeNode || !cathodeNode) return null;

    // Calculate dimensions and position
    const x1 = anodeNode.canvasPosition.x;
    const y1 = anodeNode.canvasPosition.y;
    const x2 = cathodeNode.canvasPosition.x;
    const y2 = cathodeNode.canvasPosition.y;

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    // Diode body dimensions (fixed — NOT stretched)
    const bodyWidth = 16;
    const bodyHeight = 10;

    return (
      <g
        transform={`translate(${centerX}, ${centerY}) rotate(${angle})`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ cursor: "pointer" }}
      >
        {/* Selection highlight */}
        {isSelected && (
          <rect
            x={-bodyWidth / 2 - 4}
            y={-bodyHeight / 2 - 4}
            width={bodyWidth + 8}
            height={bodyHeight + 8}
            fill="none"
            stroke={COLORS.SELECTION_HIGHLIGHT}
            strokeWidth={2}
            strokeDasharray="4 2"
            rx={3}
          />
        )}

        {/* Anode lead (left) — stretches from pin to body edge */}
        <line
          x1={-length / 2}
          y1={0}
          x2={-bodyWidth / 2}
          y2={0}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />

        {/* Cathode lead (right) — stretches from body edge to pin */}
        <line
          x1={bodyWidth / 2}
          y1={0}
          x2={length / 2}
          y2={0}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />

        {/* Diode body — black cylinder */}
        <rect
          x={-bodyWidth / 2}
          y={-bodyHeight / 2}
          width={bodyWidth}
          height={bodyHeight}
          fill="#1a1a1a"
          stroke="#333"
          strokeWidth={1}
          rx={2}
        />

        {/* Silver cathode band stripe */}
        <rect
          x={bodyWidth / 2 - 4}
          y={-bodyHeight / 2}
          width={3}
          height={bodyHeight}
          fill="#C0C0C0"
          stroke="#999"
          strokeWidth={0.5}
          rx={0.5}
        />

        {/* Directional arrow (triangle pointing from anode → cathode) */}
        <polygon
          points={`${-bodyWidth / 4},${-bodyHeight / 3} ${bodyWidth / 4 - 2},0 ${-bodyWidth / 4},${bodyHeight / 3}`}
          fill={isActive ? "#4ADE80" : "#666"}
          stroke="none"
        />

        {/* Cathode bar (vertical line at cathode side of triangle) */}
        <line
          x1={bodyWidth / 4 - 2}
          y1={-bodyHeight / 3}
          x2={bodyWidth / 4 - 2}
          y2={bodyHeight / 3}
          stroke={isActive ? "#4ADE80" : "#888"}
          strokeWidth={1.5}
        />

        {/* Label */}
        <text
          x={0}
          y={bodyHeight / 2 + 10}
          fill="#666"
          fontSize="7"
          textAnchor="middle"
        >
          1N4148
        </text>
      </g>
    );
  },
  areComponentPropsEqual<DiodeProps>(["isActive"]),
);

Diode.displayName = "Diode";

export default Diode;
