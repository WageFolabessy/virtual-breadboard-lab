"use client";

// ============================================
// 555 TIMER IC SVG COMPONENT (DIP-8 Package)
// Renders a standard DIP-8 IC with 8 dynamic leads
// ============================================

import React from "react";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

interface Timer555Props extends BaseComponentProps {
  isActive: boolean;
}

// Standard 555 pin names for labeling
const PIN_LABELS = ["GND", "TRIG", "OUT", "RST", "CTRL", "THR", "DIS", "VCC"];

export const Timer555: React.FC<Timer555Props> = React.memo(
  ({ component, nodes, isSelected, isActive, onClick }) => {
    // Get all 8 pin positions
    // Pins 0-3: top side (left to right)
    // Pins 4-7: bottom side (right to left — U-shape)
    const pinPositions = component.pins.map((pin) => {
      if (!pin.connectedNodeId) return null;
      const node = nodes.get(pin.connectedNodeId);
      if (!node) return null;
      return { x: node.canvasPosition.x, y: node.canvasPosition.y };
    });

    // Need at least all 8 pins
    if (pinPositions.some((p) => p === null)) return null;

    const positions = pinPositions as { x: number; y: number }[];

    // Calculate body bounds from pin positions
    // Top side: pins 0-3 (left to right on one row)
    // Bottom side: pins 4-7 (right to left on opposite row)
    const topLeft = positions[0];
    const topRight = positions[3];
    const bottomLeft = positions[7]; // Pin 8 (VCC) is at col on opposite row

    const bodyPadX = 3;
    const bodyPadY = 4;
    const bodyX = topLeft.x - bodyPadX;
    const bodyY = topLeft.y - bodyPadY;
    const bodyW = topRight.x - topLeft.x + bodyPadX * 2;
    const bodyH = bottomLeft.y - topLeft.y + bodyPadY * 2;

    // Center of body for label
    const cx = bodyX + bodyW / 2;
    const cy = bodyY + bodyH / 2;

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
            x={bodyX - 4}
            y={bodyY - 4}
            width={bodyW + 8}
            height={bodyH + 8}
            fill="none"
            stroke={COLORS.SELECTION_HIGHLIGHT}
            strokeWidth={2}
            strokeDasharray="4 2"
            rx={3}
          />
        )}

        {/* Lead wires — from pin holes to body edge */}
        {/* Top side leads (pins 1-4) — leads go DOWN from pin to body top */}
        {positions.slice(0, 4).map((pos, i) => (
          <line
            key={`top-lead-${i}`}
            x1={pos.x}
            y1={pos.y}
            x2={pos.x}
            y2={bodyY + bodyH * 0 + 0}
            stroke={isActive ? "#C0C0C0" : "#888"}
            strokeWidth={1.5}
          />
        ))}
        {/* Bottom side leads (pins 5-8) — leads go UP from pin to body bottom */}
        {positions.slice(4, 8).map((pos, i) => (
          <line
            key={`bottom-lead-${i}`}
            x1={pos.x}
            y1={pos.y}
            x2={pos.x}
            y2={bodyY + bodyH}
            stroke={isActive ? "#C0C0C0" : "#888"}
            strokeWidth={1.5}
          />
        ))}

        {/* IC Body — black rectangle */}
        <rect
          x={bodyX}
          y={bodyY}
          width={bodyW}
          height={bodyH}
          fill={isActive ? "#1a1a1a" : "#111"}
          stroke={isActive ? "#4ADE80" : "#444"}
          strokeWidth={1.5}
          rx={2}
        />

        {/* Orientation notch (half-circle on left side) */}
        <path
          d={`M ${bodyX} ${cy - 3} A 3 3 0 0 1 ${bodyX} ${cy + 3}`}
          fill={isActive ? "#333" : "#222"}
          stroke={isActive ? "#4ADE80" : "#555"}
          strokeWidth={1}
        />

        {/* Pin 1 dot indicator (top-left corner) */}
        <circle
          cx={bodyX + 5}
          cy={bodyY + 5}
          r={1.5}
          fill={isActive ? "#4ADE80" : "#666"}
        />

        {/* IC label */}
        <text
          x={cx}
          y={cy - 2}
          fill="#ccc"
          fontSize="6"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          555
        </text>
        <text
          x={cx}
          y={cy + 5}
          fill="#999"
          fontSize="4"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          TIMER
        </text>

        {/* Pin number labels — top side (pins 1-4) */}
        {positions.slice(0, 4).map((pos, i) => (
          <text
            key={`top-label-${i}`}
            x={pos.x}
            y={bodyY + 6}
            fill="#888"
            fontSize="3.5"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {PIN_LABELS[i]}
          </text>
        ))}

        {/* Pin number labels — bottom side (pins 5-8) */}
        {positions.slice(4, 8).map((pos, i) => (
          <text
            key={`bottom-label-${i}`}
            x={pos.x}
            y={bodyY + bodyH - 5}
            fill="#888"
            fontSize="3.5"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {PIN_LABELS[i + 4]}
          </text>
        ))}

        {/* Active glow */}
        {isActive && (
          <rect
            x={bodyX - 2}
            y={bodyY - 2}
            width={bodyW + 4}
            height={bodyH + 4}
            fill="none"
            stroke="rgba(74, 222, 128, 0.25)"
            strokeWidth={2}
            rx={3}
            style={{ filter: "blur(3px)" }}
          />
        )}
      </g>
    );
  },
  areComponentPropsEqual<Timer555Props>(["isActive"]),
);

Timer555.displayName = "Timer555";

export default Timer555;
