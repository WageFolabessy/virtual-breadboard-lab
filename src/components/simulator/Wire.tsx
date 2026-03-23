'use client';

// ============================================
// WIRE SVG COMPONENT
// Renders wires connecting breadboard nodes
// ============================================

import React from 'react';
import { Wire as WireType, BreadboardNode } from '@/lib/types';
import { RENDER, COLORS } from '@/lib/constants';

interface WireProps {
  wire: WireType;
  nodes: Map<string, BreadboardNode>;
  isActive: boolean;
  onDelete: (wireId: string) => void;
}

export const Wire: React.FC<WireProps> = ({ wire, nodes, isActive, onDelete }) => {
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
  const perpX = -dy / distance * curveAmount;
  const perpY = dx / distance * curveAmount;
  
  const controlX = midX + perpX;
  const controlY = midY + perpY;

  // Path for curved wire
  const pathD = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;

  return (
    <g className="wire-group">
      {/* Wire shadow */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={RENDER.WIRE_WIDTH + 2}
        strokeLinecap="round"
        transform="translate(1, 1)"
      />

      {/* Main wire */}
      <path
        d={pathD}
        fill="none"
        stroke={isActive ? COLORS.NODE_ACTIVE : wire.color}
        strokeWidth={RENDER.WIRE_WIDTH}
        strokeLinecap="round"
        className="transition-all duration-200"
      />

      {/* Wire highlight (for active state) */}
      {isActive && (
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.NODE_ACTIVE}
          strokeWidth={RENDER.WIRE_WIDTH + 2}
          strokeLinecap="round"
          opacity={0.3}
        />
      )}

      {/* Invisible wider path for easier click detection */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={RENDER.WIRE_WIDTH + 10}
        strokeLinecap="round"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(wire.id);
        }}
      />

      {/* Wire endpoints */}
      <circle
        cx={x1}
        cy={y1}
        r={3}
        fill={isActive ? COLORS.NODE_ACTIVE : wire.color}
      />
      <circle
        cx={x2}
        cy={y2}
        r={3}
        fill={isActive ? COLORS.NODE_ACTIVE : wire.color}
      />
    </g>
  );
};

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
      <circle
        cx={x1}
        cy={y1}
        r={5}
        fill={color}
        opacity={0.7}
      />

      {/* End point indicator */}
      <circle
        cx={currentX}
        cy={currentY}
        r={4}
        fill={color}
        opacity={0.5}
      />
    </g>
  );
};

export default Wire;
