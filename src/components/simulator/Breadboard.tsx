'use client';

// ============================================
// BREADBOARD SVG COMPONENT
// Renders the breadboard grid with interactive nodes
// ============================================
//
// PERFORMANCE OPTIMIZATIONS:
// 1. Node components receive handlers as props (no internal useCircuitStore)
// 2. Hover state uses native DOM manipulation (no React re-render)
// 3. Parent component passes stable callbacks
// 4. Uses useShallow for Set/Map selectors to avoid reference-change re-renders
// ============================================

import React, { useMemo, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCircuitStore } from '@/lib/store/circuit-store';
import { BreadboardNode, ToolType } from '@/lib/types';
import { BREADBOARD, RENDER, COLORS } from '@/lib/constants';

// ---- Node Component ----
// CRITICAL: No useCircuitStore inside this component - receives everything via props
interface NodeProps {
  node: BreadboardNode;
  isActive: boolean;
  isWireStart: boolean;
  isPlacementTarget: boolean;
  isPositive: boolean;   // Node has positive voltage potential
  isNegative: boolean;   // Node has negative voltage potential
  selectedTool: ToolType;
  onNodeClick: (nodeId: string) => void;
}

const BreadboardNodeComponent: React.FC<NodeProps> = React.memo(
  ({ node, isActive, isWireStart, isPlacementTarget, isPositive, isNegative, selectedTool, onNodeClick }) => {
    // Use refs for hover state to avoid re-renders
    const circleRef = useRef<SVGCircleElement>(null);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onNodeClick(node.id);
      },
      [onNodeClick, node.id]
    );

    // Determine fill color based on state priority
    const getFillColor = useCallback((): string => {
      if (node.isOccupied) return COLORS.NODE_OCCUPIED;
      if (isActive) return COLORS.NODE_ACTIVE;
      if (isWireStart) return COLORS.SELECTION_HIGHLIGHT;
      if (isPlacementTarget) return COLORS.WIRE_GREEN;
      // Voltage potential indicators (only show when not occupied/selected)
      if (isPositive) return 'rgba(239, 68, 68, 0.6)'; // Red for positive
      if (isNegative) return 'rgba(59, 130, 246, 0.6)'; // Blue for negative
      // Default rail colors
      if (node.stripType === 'power-rail') return COLORS.POWER_RAIL;
      if (node.stripType === 'ground-rail') return COLORS.GROUND_RAIL;
      return COLORS.NODE_EMPTY;
    }, [node.isOccupied, node.stripType, isActive, isWireStart, isPlacementTarget, isPositive, isNegative]);

    // Use native DOM for hover effects (no React re-render)
    const handleMouseEnter = useCallback(() => {
      if (circleRef.current) {
        circleRef.current.setAttribute('r', String(RENDER.NODE_HOVER_RADIUS));
        circleRef.current.setAttribute('stroke', '#fff');
        circleRef.current.setAttribute('stroke-width', '1.5');
        // Update fill for hover if not in a special state
        if (!node.isOccupied && !isActive && !isWireStart && !isPlacementTarget && !isPositive && !isNegative) {
          circleRef.current.setAttribute('fill', COLORS.NODE_HOVER);
        }
      }
    }, [node.isOccupied, isActive, isWireStart, isPlacementTarget, isPositive, isNegative]);

    const handleMouseLeave = useCallback(() => {
      if (circleRef.current) {
        circleRef.current.setAttribute('r', String(RENDER.NODE_RADIUS));
        circleRef.current.setAttribute('stroke', 'none');
        circleRef.current.setAttribute('stroke-width', '0');
        // Restore original fill
        circleRef.current.setAttribute('fill', getFillColor());
      }
    }, [getFillColor]);

    const fillColor = getFillColor();
    const radius = isWireStart ? RENDER.NODE_HOVER_RADIUS : RENDER.NODE_RADIUS;
    const cursor = selectedTool === 'select' ? 'pointer' : 'crosshair';

    return (
      <circle
        ref={circleRef}
        cx={node.canvasPosition.x}
        cy={node.canvasPosition.y}
        r={radius}
        fill={fillColor}
        stroke={isWireStart ? '#fff' : 'none'}
        strokeWidth={isWireStart ? 1.5 : 0}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor, transition: 'fill 0.1s ease' }}
      />
    );
  }
);

BreadboardNodeComponent.displayName = 'BreadboardNodeComponent';

// ---- Rail Label Component ----
interface RailLabelProps {
  x: number;
  y: number;
  label: string;
  color: string;
}

const RailLabel: React.FC<RailLabelProps> = ({ x, y, label, color }) => (
  <text
    x={x}
    y={y}
    fill={color}
    fontSize="14"
    fontWeight="bold"
    textAnchor="middle"
    dominantBaseline="middle"
  >
    {label}
  </text>
);

// ---- Row Label Component ----
interface RowLabelProps {
  row: string;
  y: number;
}

const RowLabel: React.FC<RowLabelProps> = ({ row, y }) => (
  <text
    x={RENDER.PADDING_X - 25}
    y={y}
    fill="#666"
    fontSize="12"
    fontWeight="500"
    textAnchor="middle"
    dominantBaseline="middle"
  >
    {row}
  </text>
);

// ---- Column Number Component ----
interface ColNumberProps {
  col: number;
  x: number;
  y: number;
}

const ColNumber: React.FC<ColNumberProps> = ({ col, x, y }) => (
  <text
    x={x}
    y={y}
    fill="#888"
    fontSize="9"
    textAnchor="middle"
    dominantBaseline="middle"
  >
    {col % 5 === 0 ? col : ''}
  </text>
);

// ---- Main Breadboard Component ----
export const Breadboard: React.FC = () => {
  // Use a single shallow-compared selector for all state to minimize subscriptions
  // and prevent re-renders when references change but content is the same
  const { nodes, activeNodes, positiveNodes, negativeNodes, wireStartNodeId, placementPins, selectedTool } = useCircuitStore(
    useShallow((state) => ({
      nodes: state.nodes,
      activeNodes: state.activeNodes,
      positiveNodes: state.positiveNodes,
      negativeNodes: state.negativeNodes,
      wireStartNodeId: state.wireStartNodeId,
      placementPins: state.placementPins,
      selectedTool: state.selectedTool,
    }))
  );

  // Stable callback reference for node clicks - uses getState() to avoid dependency cycles
  const onNodeClick = useCallback((nodeId: string) => {
    useCircuitStore.getState().handleNodeClick(nodeId);
  }, []);

  // Convert nodes Map to array for rendering
  const nodesArray = useMemo(() => Array.from(nodes.values()), [nodes]);

  // Group nodes by type for layered rendering
  const { railNodes, terminalNodes } = useMemo(() => {
    const rails: BreadboardNode[] = [];
    const terminals: BreadboardNode[] = [];

    nodesArray.forEach((node) => {
      if (node.stripType === 'power-rail' || node.stripType === 'ground-rail') {
        rails.push(node);
      } else {
        terminals.push(node);
      }
    });

    return { railNodes: rails, terminalNodes: terminals };
  }, [nodesArray]);

  // Calculate board dimensions
  const boardWidth = RENDER.BOARD_WIDTH;
  const boardHeight = RENDER.BOARD_HEIGHT;

  // Generate row labels with positions
  const rowLabels = useMemo(() => {
    const labels: { row: string; y: number }[] = [];
    const allRows = [...BREADBOARD.TERMINAL_ROWS_TOP, ...BREADBOARD.TERMINAL_ROWS_BOTTOM];

    allRows.forEach((row) => {
      // Find a node in this row to get Y position
      const nodeInRow = terminalNodes.find((n) => n.id.startsWith(`${row}-`));
      if (nodeInRow) {
        labels.push({ row, y: nodeInRow.canvasPosition.y });
      }
    });

    return labels;
  }, [terminalNodes]);

  // Get column positions for labels
  const colLabels = useMemo(() => {
    const labels: { col: number; x: number }[] = [];
    
    for (let col = 1; col <= BREADBOARD.COLUMNS; col++) {
      const node = nodes.get(`A-${col}`);
      if (node) {
        labels.push({ col, x: node.canvasPosition.x });
      }
    }

    return labels;
  }, [nodes]);

  // Calculate rail background rectangles
  const railBackgrounds = useMemo(() => {
    const topPowerNode = nodes.get('power-top-1');
    const topGroundNode = nodes.get('ground-top-1');
    const bottomPowerNode = nodes.get('power-bottom-1');
    const bottomGroundNode = nodes.get('ground-bottom-1');

    if (!topPowerNode || !topGroundNode || !bottomPowerNode || !bottomGroundNode) {
      return [];
    }

    const width = (BREADBOARD.COLUMNS - 1) * RENDER.NODE_SPACING + 20;

    return [
      {
        id: 'top-power-bg',
        x: RENDER.PADDING_X - 10,
        y: topPowerNode.canvasPosition.y - 8,
        width,
        height: 16,
        fill: COLORS.POWER_RAIL_BG,
      },
      {
        id: 'top-ground-bg',
        x: RENDER.PADDING_X - 10,
        y: topGroundNode.canvasPosition.y - 8,
        width,
        height: 16,
        fill: COLORS.GROUND_RAIL_BG,
      },
      {
        id: 'bottom-power-bg',
        x: RENDER.PADDING_X - 10,
        y: bottomPowerNode.canvasPosition.y - 8,
        width,
        height: 16,
        fill: COLORS.POWER_RAIL_BG,
      },
      {
        id: 'bottom-ground-bg',
        x: RENDER.PADDING_X - 10,
        y: bottomGroundNode.canvasPosition.y - 8,
        width,
        height: 16,
        fill: COLORS.GROUND_RAIL_BG,
      },
    ];
  }, [nodes]);

  return (
    <svg
      width={boardWidth}
      height={boardHeight}
      viewBox={`0 0 ${boardWidth} ${boardHeight}`}
      className="breadboard-svg"
    >
      {/* Board background */}
      <rect
        x={0}
        y={0}
        width={boardWidth}
        height={boardHeight}
        fill={COLORS.BOARD_BACKGROUND}
        rx={8}
        ry={8}
      />

      {/* Board border */}
      <rect
        x={2}
        y={2}
        width={boardWidth - 4}
        height={boardHeight - 4}
        fill="none"
        stroke={COLORS.BOARD_BORDER}
        strokeWidth={2}
        rx={6}
        ry={6}
      />

      {/* Rail backgrounds */}
      {railBackgrounds.map((bg) => (
        <rect
          key={bg.id}
          x={bg.x}
          y={bg.y}
          width={bg.width}
          height={bg.height}
          fill={bg.fill}
          rx={4}
          ry={4}
        />
      ))}

      {/* Center gap indicator */}
      <rect
        x={RENDER.PADDING_X - 10}
        y={
          (nodes.get('E-1')?.canvasPosition.y ?? 0) +
          RENDER.NODE_SPACING / 2 +
          2
        }
        width={(BREADBOARD.COLUMNS - 1) * RENDER.NODE_SPACING + 20}
        height={RENDER.SECTION_GAP - 4}
        fill="#D4CFC0"
        rx={2}
      />

      {/* Rail labels */}
      {railBackgrounds.length > 0 && (
        <>
          <RailLabel
            x={RENDER.PADDING_X - 35}
            y={railBackgrounds[0].y + 8}
            label="+"
            color={COLORS.POWER_RAIL}
          />
          <RailLabel
            x={RENDER.PADDING_X - 35}
            y={railBackgrounds[1].y + 8}
            label="-"
            color={COLORS.GROUND_RAIL}
          />
          <RailLabel
            x={RENDER.PADDING_X - 35}
            y={railBackgrounds[2].y + 8}
            label="+"
            color={COLORS.POWER_RAIL}
          />
          <RailLabel
            x={RENDER.PADDING_X - 35}
            y={railBackgrounds[3].y + 8}
            label="-"
            color={COLORS.GROUND_RAIL}
          />
        </>
      )}

      {/* Row labels */}
      {rowLabels.map(({ row, y }) => (
        <RowLabel key={row} row={row} y={y} />
      ))}

      {/* Column numbers */}
      {colLabels.map(({ col, x }) => (
        <ColNumber
          key={col}
          col={col}
          x={x}
          y={RENDER.PADDING_Y + 2 * RENDER.NODE_SPACING + RENDER.RAIL_GAP + RENDER.RAIL_TO_TERMINAL_GAP - 12}
        />
      ))}

      {/* Rail nodes */}
      {railNodes.map((node) => (
        <BreadboardNodeComponent
          key={node.id}
          node={node}
          isActive={activeNodes.has(node.id)}
          isWireStart={wireStartNodeId === node.id}
          isPlacementTarget={placementPins.includes(node.id)}
          isPositive={positiveNodes.has(node.id)}
          isNegative={negativeNodes.has(node.id)}
          selectedTool={selectedTool}
          onNodeClick={onNodeClick}
        />
      ))}

      {/* Terminal nodes */}
      {terminalNodes.map((node) => (
        <BreadboardNodeComponent
          key={node.id}
          node={node}
          isActive={activeNodes.has(node.id)}
          isWireStart={wireStartNodeId === node.id}
          isPlacementTarget={placementPins.includes(node.id)}
          isPositive={positiveNodes.has(node.id)}
          isNegative={negativeNodes.has(node.id)}
          selectedTool={selectedTool}
          onNodeClick={onNodeClick}
        />
      ))}
    </svg>
  );
};

export default Breadboard;
