'use client';

// ============================================
// RESISTOR SVG COMPONENT
// ============================================

import React from 'react';
import { CircuitComponent, ResistorState, BreadboardNode } from '@/lib/types';
import { COLORS } from '@/lib/constants';

interface ResistorProps {
  component: CircuitComponent;
  nodes: Map<string, BreadboardNode>;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}

export const Resistor: React.FC<ResistorProps> = ({
  component,
  nodes,
  isSelected,
  isActive,
  onClick,
}) => {
  const state = component.state as ResistorState;

  const pin1 = component.pins.find((p) => p.pinType === 'terminal-1');
  const pin2 = component.pins.find((p) => p.pinType === 'terminal-2');

  const node1 = pin1?.connectedNodeId ? nodes.get(pin1.connectedNodeId) : null;
  const node2 = pin2?.connectedNodeId ? nodes.get(pin2.connectedNodeId) : null;

  if (!node1 || !node2) return null;

  const x1 = node1.canvasPosition.x;
  const y1 = node1.canvasPosition.y;
  const x2 = node2.canvasPosition.x;
  const y2 = node2.canvasPosition.y;

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  const bodyWidth = Math.max(length - 16, 20);
  const bodyHeight = 8;

  // Color bands (simplified - brown, red, brown = 220Ω)
  const bandColors = ['#8B4513', '#DC2626', '#8B4513', '#FFD700'];

  return (
    <g
      transform={`translate(${centerX}, ${centerY}) rotate(${angle})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ cursor: 'pointer' }}
    >
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
          rx={2}
        />
      )}

      {/* Leads */}
      <line
        x1={-length / 2}
        y1={0}
        x2={-bodyWidth / 2}
        y2={0}
        stroke={isActive ? COLORS.NODE_ACTIVE : '#888'}
        strokeWidth={2}
      />
      <line
        x1={bodyWidth / 2}
        y1={0}
        x2={length / 2}
        y2={0}
        stroke={isActive ? COLORS.NODE_ACTIVE : '#888'}
        strokeWidth={2}
      />

      {/* Body */}
      <rect
        x={-bodyWidth / 2}
        y={-bodyHeight / 2}
        width={bodyWidth}
        height={bodyHeight}
        fill="#D4B896"
        stroke="#8B7355"
        strokeWidth={1}
        rx={1}
      />

      {/* Color bands */}
      {bandColors.map((color, i) => (
        <rect
          key={i}
          x={-bodyWidth / 2 + 4 + i * (bodyWidth - 8) / 4}
          y={-bodyHeight / 2 + 1}
          width={3}
          height={bodyHeight - 2}
          fill={color}
        />
      ))}

      {/* Value label */}
      <text
        x={0}
        y={bodyHeight / 2 + 10}
        fill="#666"
        fontSize="8"
        textAnchor="middle"
      >
        {state.resistance}Ω
      </text>
    </g>
  );
};

export default Resistor;
