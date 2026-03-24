"use client";

// ============================================
// LED SVG COMPONENT
// Visual representation of a Light Emitting Diode
// Dynamic leads stretch from body edge to pin positions
// ============================================

import React from "react";
import { asLEDState } from "@/lib/types";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

interface LEDProps extends BaseComponentProps {
  isLit: boolean;
}

export const LED: React.FC<LEDProps> = React.memo(
  ({ component, nodes, isSelected, isLit, onClick }) => {
    const state = asLEDState(component.state);
    const ledColor = state?.color || COLORS.LED_ON;

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

    // Calculate center, rotation, and DYNAMIC distance
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    // LED body dimensions (fixed — NOT stretched)
    const bodyRadiusX = 8;
    const bodyRadiusY = 6;

    // Glow filter ID
    const glowFilterId = `led-glow-${component.id}`;

    return (
      <g
        transform={`translate(${centerX}, ${centerY}) rotate(${angle})`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ cursor: "pointer" }}
      >
        {/* Define glow filter */}
        <defs>
          <filter
            id={glowFilterId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`led-gradient-${component.id}`}>
            <stop
              offset="0%"
              stopColor={isLit ? ledColor : COLORS.LED_OFF}
              stopOpacity="1"
            />
            <stop
              offset="70%"
              stopColor={isLit ? ledColor : COLORS.LED_OFF}
              stopOpacity="0.8"
            />
            <stop
              offset="100%"
              stopColor={isLit ? ledColor : COLORS.LED_OFF}
              stopOpacity="0.6"
            />
          </radialGradient>
        </defs>

        {/* Selection highlight */}
        {isSelected && (
          <ellipse
            cx={0}
            cy={0}
            rx={bodyRadiusX + 5}
            ry={bodyRadiusY + 5}
            fill="none"
            stroke={COLORS.SELECTION_HIGHLIGHT}
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}

        {/* DYNAMIC Anode lead — stretches from body edge to anode pin position */}
        <line
          x1={-length / 2}
          y1={0}
          x2={-bodyRadiusX - 1}
          y2={0}
          stroke="#888"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* DYNAMIC Cathode lead — stretches from body edge to cathode pin position */}
        <line
          x1={bodyRadiusX + 1}
          y1={0}
          x2={length / 2}
          y2={0}
          stroke="#888"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* LED body (dome shape) */}
        <ellipse
          cx={0}
          cy={0}
          rx={bodyRadiusX}
          ry={bodyRadiusY}
          fill={`url(#led-gradient-${component.id})`}
          stroke={isLit ? ledColor : "#555"}
          strokeWidth={1.5}
          filter={isLit ? `url(#${glowFilterId})` : undefined}
        />

        {/* LED flat bottom (cathode side indicator) */}
        <rect
          x={bodyRadiusX - 3}
          y={-3}
          width={3}
          height={6}
          fill={isLit ? ledColor : COLORS.LED_OFF}
          opacity={0.8}
        />

        {/* Internal reflection highlight */}
        <ellipse
          cx={-2}
          cy={-2}
          rx={3}
          ry={2}
          fill="#fff"
          opacity={isLit ? 0.6 : 0.3}
        />

        {/* Polarity markers */}
        <text
          x={-bodyRadiusX - 6}
          y={-8}
          fill="#666"
          fontSize="8"
          textAnchor="middle"
        >
          +
        </text>
        <text
          x={bodyRadiusX + 6}
          y={-8}
          fill="#666"
          fontSize="8"
          textAnchor="middle"
        >
          -
        </text>
      </g>
    );
  },
  areComponentPropsEqual<LEDProps>(["isLit"]),
);

LED.displayName = "LED";

export default LED;
