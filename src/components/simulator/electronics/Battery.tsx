"use client";

// ============================================
// BATTERY SVG COMPONENT
// Visual representation of a battery/power source
// ============================================

import React from "react";
import { asBatteryState } from "@/lib/types";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

type BatteryProps = BaseComponentProps;

export const Battery: React.FC<BatteryProps> = React.memo(
  ({ component, nodes, isSelected, onClick }) => {
    const state = asBatteryState(component.state);
    if (!state) return null;

    // Get pin positions
    const positivePin = component.pins.find((p) => p.pinType === "positive");
    const negativePin = component.pins.find((p) => p.pinType === "negative");

    const positiveNode = positivePin?.connectedNodeId
      ? nodes.get(positivePin.connectedNodeId)
      : null;
    const negativeNode = negativePin?.connectedNodeId
      ? nodes.get(negativePin.connectedNodeId)
      : null;

    if (!positiveNode || !negativeNode) return null;

    // Calculate dimensions and position
    const x1 = positiveNode.canvasPosition.x;
    const y1 = positiveNode.canvasPosition.y;
    const x2 = negativeNode.canvasPosition.x;
    const y2 = negativeNode.canvasPosition.y;

    // Calculate center and rotation
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    // Battery dimensions
    const bodyWidth = Math.max(length - 10, 20);
    const bodyHeight = 14;

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
            rx={4}
          />
        )}

        {/* Battery body */}
        <rect
          x={-bodyWidth / 2}
          y={-bodyHeight / 2}
          width={bodyWidth}
          height={bodyHeight}
          fill={state.isOn ? COLORS.BATTERY_BODY : "#888"}
          rx={2}
          stroke="#333"
          strokeWidth={1}
        />

        {/* Positive terminal (larger) */}
        <rect
          x={bodyWidth / 2 - 2}
          y={-bodyHeight / 4}
          width={4}
          height={bodyHeight / 2}
          fill={COLORS.BATTERY_POSITIVE}
          rx={1}
        />

        {/* Positive symbol */}
        <text
          x={bodyWidth / 2 - 12}
          y={1}
          fill="#fff"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          +
        </text>

        {/* Negative symbol */}
        <text
          x={-bodyWidth / 2 + 12}
          y={1}
          fill="#fff"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          -
        </text>

        {/* Voltage label */}
        <text
          x={0}
          y={1}
          fill="#fff"
          fontSize="8"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {state.voltage}V
        </text>
      </g>
    );
  },
  areComponentPropsEqual<BatteryProps>(),
);

Battery.displayName = "Battery";

export default Battery;
