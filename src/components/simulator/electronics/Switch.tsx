'use client';

// ============================================
// SWITCH SVG COMPONENT
// Toggle switch that can be clicked to open/close
// ============================================

import React from 'react';
import { CircuitComponent, SwitchState, BreadboardNode } from '@/lib/types';
import { COLORS } from '@/lib/constants';

interface SwitchProps {
  component: CircuitComponent;
  nodes: Map<string, BreadboardNode>;
  isSelected: boolean;
  isActive: boolean;
  onToggle: () => void;
  onClick: () => void;
}

export const Switch: React.FC<SwitchProps> = ({
  component,
  nodes,
  isSelected,
  isActive,
  onToggle,
  onClick,
}) => {
  const state = component.state as SwitchState;
  const isClosed = state.isClosed;

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <g
      transform={`translate(${centerX}, ${centerY}) rotate(${angle})`}
      style={{ cursor: 'pointer' }}
    >
      {isSelected && (
        <rect
          x={-length / 2 - 4}
          y={-12}
          width={length + 8}
          height={24}
          fill="none"
          stroke={COLORS.SELECTION_HIGHLIGHT}
          strokeWidth={2}
          strokeDasharray="4 2"
          rx={4}
        />
      )}

      {/* Background for click area */}
      <rect
        x={-length / 2}
        y={-10}
        width={length}
        height={20}
        fill="transparent"
        onClick={handleSelect}
      />

      {/* Left contact point */}
      <circle
        cx={-length / 2 + 8}
        cy={0}
        r={4}
        fill={isActive && isClosed ? COLORS.NODE_ACTIVE : '#666'}
        stroke="#333"
        strokeWidth={1}
      />

      {/* Right contact point */}
      <circle
        cx={length / 2 - 8}
        cy={0}
        r={4}
        fill={isActive && isClosed ? COLORS.NODE_ACTIVE : '#666'}
        stroke="#333"
        strokeWidth={1}
      />

      {/* Switch lever */}
      <line
        x1={-length / 2 + 8}
        y1={0}
        x2={isClosed ? length / 2 - 8 : length / 2 - 16}
        y2={isClosed ? 0 : -8}
        stroke={isClosed ? (isActive ? COLORS.NODE_ACTIVE : '#333') : '#666'}
        strokeWidth={3}
        strokeLinecap="round"
        style={{ transition: 'all 0.15s ease' }}
      />

      {/* Toggle button */}
      <g onClick={handleClick}>
        <rect
          x={-12}
          y={-18}
          width={24}
          height={12}
          fill={isClosed ? '#22C55E' : '#EF4444'}
          rx={3}
          stroke="#333"
          strokeWidth={1}
        />
        <text
          x={0}
          y={-10}
          fill="white"
          fontSize="7"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {isClosed ? 'ON' : 'OFF'}
        </text>
      </g>

      {/* Lead wires */}
      <line
        x1={-length / 2}
        y1={0}
        x2={-length / 2 + 4}
        y2={0}
        stroke="#888"
        strokeWidth={2}
      />
      <line
        x1={length / 2 - 4}
        y1={0}
        x2={length / 2}
        y2={0}
        stroke="#888"
        strokeWidth={2}
      />
    </g>
  );
};

export default Switch;
