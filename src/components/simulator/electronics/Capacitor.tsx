"use client";

// ============================================
// CAPACITOR SVG COMPONENT
// ============================================

import React from "react";
import { asCapacitorState } from "@/lib/types";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

interface CapacitorProps extends BaseComponentProps {
  isActive: boolean;
}

export const Capacitor: React.FC<CapacitorProps> = React.memo(
  ({ component, nodes, isSelected, isActive, onClick }) => {
    const state = asCapacitorState(component.state);
    if (!state) return null;

    const positivePin = component.pins.find((p) => p.pinType === "positive");
    const negativePin = component.pins.find((p) => p.pinType === "negative");

    const node1 = positivePin?.connectedNodeId
      ? nodes.get(positivePin.connectedNodeId)
      : null;
    const node2 = negativePin?.connectedNodeId
      ? nodes.get(negativePin.connectedNodeId)
      : null;

    if (!node1 || !node2) return null;

    const x1 = node1.canvasPosition.x;
    const y1 = node1.canvasPosition.y;
    const x2 = node2.canvasPosition.x;
    const y2 = node2.canvasPosition.y;

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    const plateGap = 4;
    const plateHeight = 14;

    return (
      <g
        transform={`translate(${centerX}, ${centerY}) rotate(${angle})`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ cursor: "pointer" }}
      >
        {isSelected && (
          <rect
            x={-length / 2 - 4}
            y={-plateHeight / 2 - 4}
            width={length + 8}
            height={plateHeight + 8}
            fill="none"
            stroke={COLORS.SELECTION_HIGHLIGHT}
            strokeWidth={2}
            strokeDasharray="4 2"
            rx={2}
          />
        )}

        {/* Left lead */}
        <line
          x1={-length / 2}
          y1={0}
          x2={-plateGap / 2 - 2}
          y2={0}
          stroke={isActive ? COLORS.NODE_ACTIVE : "#888"}
          strokeWidth={2}
        />

        {/* Right lead */}
        <line
          x1={plateGap / 2 + 2}
          y1={0}
          x2={length / 2}
          y2={0}
          stroke={isActive ? COLORS.NODE_ACTIVE : "#888"}
          strokeWidth={2}
        />

        {/* Left plate (positive) */}
        <line
          x1={-plateGap / 2}
          y1={-plateHeight / 2}
          x2={-plateGap / 2}
          y2={plateHeight / 2}
          stroke={isActive ? COLORS.NODE_ACTIVE : "#333"}
          strokeWidth={3}
        />

        {/* Right plate (curved for electrolytic style) */}
        <path
          d={`M ${plateGap / 2} ${-plateHeight / 2} Q ${plateGap / 2 + 3} 0 ${plateGap / 2} ${plateHeight / 2}`}
          fill="none"
          stroke={isActive ? COLORS.NODE_ACTIVE : "#333"}
          strokeWidth={3}
        />

        {/* Positive marker */}
        <text
          x={-plateGap / 2 - 8}
          y={-plateHeight / 2 - 2}
          fill="#666"
          fontSize="8"
          fontWeight="bold"
          textAnchor="middle"
        >
          +
        </text>

        {/* Value label */}
        <text
          x={0}
          y={plateHeight / 2 + 10}
          fill="#666"
          fontSize="8"
          textAnchor="middle"
        >
          {state.capacitance}µF
        </text>
      </g>
    );
  },
  areComponentPropsEqual<CapacitorProps>(["isActive"]),
);

Capacitor.displayName = "Capacitor";

export default Capacitor;
