"use client";

// ============================================
// TACTILE BUTTON SVG COMPONENT
// 4-pin momentary push button that straddles center trench
// Conducts only while held down (onMouseDown/onMouseUp)
// ============================================

import React from "react";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

interface TactileButtonProps extends BaseComponentProps {
  isActive: boolean;
  onPress: () => void;
  onRelease: () => void;
}

export const TactileButton: React.FC<TactileButtonProps> = React.memo(
  ({ component, nodes, isSelected, isActive, onPress, onRelease, onClick }) => {
    // Resolve all 4 pin positions
    const pinTL = component.pins.find((p) => p.pinType === "tb-top-left");
    const pinBL = component.pins.find((p) => p.pinType === "tb-bottom-left");
    const pinTR = component.pins.find((p) => p.pinType === "tb-top-right");
    const pinBR = component.pins.find((p) => p.pinType === "tb-bottom-right");

    const nodeTL = pinTL?.connectedNodeId
      ? nodes.get(pinTL.connectedNodeId)
      : null;
    const nodeBL = pinBL?.connectedNodeId
      ? nodes.get(pinBL.connectedNodeId)
      : null;
    const nodeTR = pinTR?.connectedNodeId
      ? nodes.get(pinTR.connectedNodeId)
      : null;
    const nodeBR = pinBR?.connectedNodeId
      ? nodes.get(pinBR.connectedNodeId)
      : null;

    if (!nodeTL || !nodeBL || !nodeTR || !nodeBR) return null;

    // Compute center and dimensions
    const centerX =
      (nodeTL.canvasPosition.x +
        nodeBL.canvasPosition.x +
        nodeTR.canvasPosition.x +
        nodeBR.canvasPosition.x) /
      4;
    const centerY =
      (nodeTL.canvasPosition.y +
        nodeBL.canvasPosition.y +
        nodeTR.canvasPosition.y +
        nodeBR.canvasPosition.y) /
      4;

    const width = Math.abs(nodeTR.canvasPosition.x - nodeTL.canvasPosition.x);
    const height = Math.abs(nodeBL.canvasPosition.y - nodeTL.canvasPosition.y);

    const bodyW = Math.max(width + 8, 22);
    const bodyH = Math.max(height + 8, 22);
    const btnRadius = Math.min(bodyW, bodyH) * 0.3;

    const handlePress = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onPress();
    };

    const handleRelease = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRelease();
    };

    const handleSelect = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
    };

    return (
      <g style={{ cursor: "pointer" }}>
        {/* Selection highlight */}
        {isSelected && (
          <rect
            x={centerX - bodyW / 2 - 4}
            y={centerY - bodyH / 2 - 4}
            width={bodyW + 8}
            height={bodyH + 8}
            fill="none"
            stroke={COLORS.SELECTION_HIGHLIGHT}
            strokeWidth={2}
            strokeDasharray="4 2"
            rx={4}
          />
        )}

        {/* Pin leads — lines from each corner node to the body edge */}
        {/* Top-left lead */}
        <line
          x1={nodeTL.canvasPosition.x}
          y1={nodeTL.canvasPosition.y}
          x2={centerX - bodyW / 2}
          y2={centerY - bodyH / 2}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />
        {/* Bottom-left lead */}
        <line
          x1={nodeBL.canvasPosition.x}
          y1={nodeBL.canvasPosition.y}
          x2={centerX - bodyW / 2}
          y2={centerY + bodyH / 2}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />
        {/* Top-right lead */}
        <line
          x1={nodeTR.canvasPosition.x}
          y1={nodeTR.canvasPosition.y}
          x2={centerX + bodyW / 2}
          y2={centerY - bodyH / 2}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />
        {/* Bottom-right lead */}
        <line
          x1={nodeBR.canvasPosition.x}
          y1={nodeBR.canvasPosition.y}
          x2={centerX + bodyW / 2}
          y2={centerY + bodyH / 2}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
        />

        {/* Body — square housing */}
        <rect
          x={centerX - bodyW / 2}
          y={centerY - bodyH / 2}
          width={bodyW}
          height={bodyH}
          fill="#2D2D2D"
          stroke="#1A1A1A"
          strokeWidth={1.5}
          rx={3}
          onClick={handleSelect}
        />

        {/* Pin contact dots — 4 corners inside the body */}
        {[
          [centerX - bodyW / 2 + 3, centerY - bodyH / 2 + 3],
          [centerX - bodyW / 2 + 3, centerY + bodyH / 2 - 3],
          [centerX + bodyW / 2 - 3, centerY - bodyH / 2 + 3],
          [centerX + bodyW / 2 - 3, centerY + bodyH / 2 - 3],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={2}
            fill={isActive ? COLORS.POWER_RAIL : "#666"}
          />
        ))}

        {/* Center button — the pressable circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={btnRadius}
          fill={isActive ? "#22C55E" : "#EF4444"}
          stroke={isActive ? "#16A34A" : "#B91C1C"}
          strokeWidth={1.5}
          onMouseDown={handlePress}
          onMouseUp={handleRelease}
          onMouseLeave={handleRelease}
          style={{
            transition: "fill 0.1s ease, transform 0.05s ease",
            filter: isActive
              ? "brightness(1.2)"
              : "shadow(0px 2px 4px rgba(0,0,0,0.5))",
          }}
        />

        {/* Inner ring detail */}
        <circle
          cx={centerX}
          cy={centerY}
          r={btnRadius * 0.5}
          fill="none"
          stroke={isActive ? "#16A34A" : "#991B1B"}
          strokeWidth={0.8}
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  },
  areComponentPropsEqual<TactileButtonProps>([
    "isActive",
    "onPress",
    "onRelease",
  ]),
);

TactileButton.displayName = "TactileButton";

export default TactileButton;
