"use client";

// ============================================
// BREADBOARD SVG COMPONENT
// Renders a realistic MB-102 style breadboard with interactive nodes
// ============================================
//
// VISUAL DESIGN:
// - Off-white plastic body with 3D drop shadow
// - Square holes with inset shadow effect (like real breadboard holes)
// - Thin red/blue stripe lines for power rails
// - Physical trench indentation in center
// - Silkscreen-style printed labels
//
// PERFORMANCE OPTIMIZATIONS:
// 1. Node components receive handlers as props (no internal useCircuitStore)
// 2. Hover state uses native DOM manipulation (no React re-render)
// 3. Parent component passes stable callbacks
// 4. Uses useShallow for Set/Map selectors to avoid reference-change re-renders
// 5. Color/hover logic extracted to useBreadboardNode hook (AGENTS.md compliance)
// ============================================

import React, { useMemo, useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { BreadboardNode, ToolType } from "@/lib/types";
import { BREADBOARD, RENDER, COLORS } from "@/lib/constants";
import { useBreadboardNode } from "@/hooks/useBreadboardNode";

// ---- Constants for hole appearance ----
const HOLE_SIZE = 6; // Square hole size
const HOLE_RADIUS = 1; // Slight corner rounding for realistic look
const HOLE_HOVER_SIZE = 8; // Larger on hover

// ---- Node Component (Square Hole with Inset Effect) ----
// CRITICAL: No useCircuitStore inside this component - receives everything via props
interface NodeProps {
  node: BreadboardNode;
  isWireStart: boolean;
  isPlacementTarget: boolean;
  isPositive: boolean; // Node has positive voltage potential
  isNegative: boolean; // Node has negative voltage potential
  selectedTool: ToolType;
  onNodeClick: (nodeId: string) => void;
}

const BreadboardNodeComponent: React.FC<NodeProps> = React.memo(
  ({
    node,
    isWireStart,
    isPlacementTarget,
    isPositive,
    isNegative,
    selectedTool,
    onNodeClick,
  }) => {
    const rectRef = useRef<SVGRectElement>(null);
    const glowRef = useRef<SVGRectElement>(null);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onNodeClick(node.id);
      },
      [onNodeClick, node.id],
    );

    // ---- AGENTS.md Compliance: Logic extracted to useBreadboardNode hook ----
    const { baseFill, glowColor, handleMouseEnter, handleMouseLeave } =
      useBreadboardNode({
        node,
        isWireStart,
        isPlacementTarget,
        isPositive,
        isNegative,
        rectRef,
        glowRef,
      });

    const cursor = selectedTool === "select" ? "pointer" : "crosshair";
    const size = isWireStart ? HOLE_HOVER_SIZE : HOLE_SIZE;
    const halfSize = size / 2;

    return (
      <g>
        {/* Glow effect for voltage potential (rendered behind the hole) */}
        {glowColor && (
          <rect
            ref={glowRef}
            x={node.canvasPosition.x - halfSize - 2}
            y={node.canvasPosition.y - halfSize - 2}
            width={size + 4}
            height={size + 4}
            rx={HOLE_RADIUS + 1}
            ry={HOLE_RADIUS + 1}
            fill={glowColor}
            style={{ filter: "blur(2px)" }}
          />
        )}

        {/* Hole outer ring (slight bevel effect) */}
        <rect
          x={node.canvasPosition.x - halfSize - 0.5}
          y={node.canvasPosition.y - halfSize - 0.5}
          width={size + 1}
          height={size + 1}
          rx={HOLE_RADIUS + 0.5}
          ry={HOLE_RADIUS + 0.5}
          fill={COLORS.NODE_RING}
        />

        {/* Main hole (square with inset shadow effect) */}
        <rect
          ref={rectRef}
          x={node.canvasPosition.x - halfSize}
          y={node.canvasPosition.y - halfSize}
          width={size}
          height={size}
          rx={HOLE_RADIUS}
          ry={HOLE_RADIUS}
          fill={baseFill}
          stroke={COLORS.NODE_INNER_SHADOW}
          strokeWidth={0.5}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            cursor,
            transition: "fill 0.1s ease",
          }}
        />

        {/* Inner highlight (top-left light reflection) */}
        <rect
          x={node.canvasPosition.x - halfSize + 1}
          y={node.canvasPosition.y - halfSize + 1}
          width={2}
          height={1}
          rx={0.5}
          fill="rgba(255, 255, 255, 0.1)"
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  },
);

BreadboardNodeComponent.displayName = "BreadboardNodeComponent";

// ---- Rail Label Component (Silkscreen Style) ----
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
    fontSize="12"
    fontWeight="600"
    fontFamily="Arial, sans-serif"
    textAnchor="middle"
    dominantBaseline="middle"
    style={{ userSelect: "none" }}
  >
    {label}
  </text>
);

// ---- Row Label Component (Silkscreen Printed) ----
interface RowLabelProps {
  row: string;
  y: number;
}

const RowLabel: React.FC<RowLabelProps> = ({ row, y }) => (
  <text
    x={RENDER.PADDING_X - 22}
    y={y}
    fill={COLORS.SILKSCREEN_TEXT}
    fontSize="10"
    fontWeight="600"
    fontFamily="Arial, sans-serif"
    textAnchor="middle"
    dominantBaseline="middle"
    style={{ userSelect: "none" }}
  >
    {row}
  </text>
);

// ---- Column Number Component (Silkscreen Printed) ----
interface ColNumberProps {
  col: number;
  x: number;
  y: number;
}

const ColNumber: React.FC<ColNumberProps> = ({ col, x, y }) => {
  // Show all column numbers for the 65-column professional breadboard
  // Use smaller font to fit all numbers
  return (
    <text
      x={x}
      y={y}
      fill={COLORS.SILKSCREEN_LABEL}
      fontSize="6"
      fontWeight="500"
      fontFamily="Arial, sans-serif"
      textAnchor="middle"
      dominantBaseline="middle"
      style={{ userSelect: "none" }}
    >
      {col}
    </text>
  );
};

// ---- Power Rail Stripe Component ----
interface RailStripeProps {
  startX: number;
  y: number;
  width: number;
  color: string;
}

const RailStripe: React.FC<RailStripeProps> = ({ startX, y, width, color }) => (
  <line
    x1={startX}
    y1={y}
    x2={startX + width}
    y2={y}
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
  />
);

// ---- Main Breadboard Component ----
export const Breadboard: React.FC = () => {
  // Use a single shallow-compared selector for all state to minimize subscriptions
  // NOTE: activeNodes removed - we only use positiveNodes/negativeNodes for voltage visualization
  const {
    nodes,
    positiveNodes,
    negativeNodes,
    wireStartNodeId,
    placementPins,
    selectedTool,
  } = useCircuitStore(
    useShallow((state) => ({
      nodes: state.nodes,
      positiveNodes: state.positiveNodes,
      negativeNodes: state.negativeNodes,
      wireStartNodeId: state.wireStartNodeId,
      placementPins: state.placementPins,
      selectedTool: state.selectedTool,
    })),
  );

  // Stable callback reference for node clicks
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
      if (node.stripType === "power-rail" || node.stripType === "ground-rail") {
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
    const allRows = [
      ...BREADBOARD.TERMINAL_ROWS_TOP,
      ...BREADBOARD.TERMINAL_ROWS_BOTTOM,
    ];

    allRows.forEach((row) => {
      const nodeInRow = terminalNodes.find((n) => n.id.startsWith(`${row}-`));
      if (nodeInRow) {
        labels.push({ row, y: nodeInRow.canvasPosition.y });
      }
    });

    return labels;
  }, [terminalNodes]);

  // Get column positions for top labels (above row J)
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

  // Get Y position for bottom column numbers (below row A, above bottom power rail)
  const bottomColY = useMemo(() => {
    const aNode = nodes.get("A-1");
    if (!aNode) return 0;
    return aNode.canvasPosition.y + 14; // Below the last terminal row
  }, [nodes]);

  // Calculate rail stripe positions
  const railStripes = useMemo(() => {
    const topPowerNode = nodes.get("power-top-1");
    const topGroundNode = nodes.get("ground-top-1");
    const bottomPowerNode = nodes.get("power-bottom-1");
    const bottomGroundNode = nodes.get("ground-bottom-1");

    if (
      !topPowerNode ||
      !topGroundNode ||
      !bottomPowerNode ||
      !bottomGroundNode
    ) {
      return [];
    }

    const stripeStartX = RENDER.PADDING_X - 8;
    const stripeWidth = (BREADBOARD.COLUMNS - 1) * RENDER.NODE_SPACING + 16;

    // Stripes directly follow node positions (factory data matches real-world layout)
    return [
      {
        id: "top-ground-stripe",
        y: topGroundNode.canvasPosition.y - 10,
        color: COLORS.GROUND_RAIL,
      },
      {
        id: "top-power-stripe",
        y: topPowerNode.canvasPosition.y + 10,
        color: COLORS.POWER_RAIL,
      },
      {
        id: "bottom-ground-stripe",
        y: bottomGroundNode.canvasPosition.y - 10,
        color: COLORS.GROUND_RAIL,
      },
      {
        id: "bottom-power-stripe",
        y: bottomPowerNode.canvasPosition.y + 10,
        color: COLORS.POWER_RAIL,
      },
    ].map((stripe) => ({
      ...stripe,
      startX: stripeStartX,
      width: stripeWidth,
    }));
  }, [nodes]);

  // Calculate center trench position
  // The trench sits between row F (bottom of top section) and row E (top of bottom section)
  const centerTrench = useMemo(() => {
    // F is the last row of top section (row index 4 in array)
    // E is the first row of bottom section (row index 5 in array)
    const fNode = nodes.get("F-1"); // Bottom of top section
    const eNode = nodes.get("E-1"); // Top of bottom section

    if (!fNode || !eNode) return null;

    // Trench starts just below row F and ends just above row E
    const y = fNode.canvasPosition.y + RENDER.NODE_SPACING / 2 + 2;
    const height = RENDER.SECTION_GAP - 4;
    const x = RENDER.PADDING_X - 8;
    const width = (BREADBOARD.COLUMNS - 1) * RENDER.NODE_SPACING + 16;

    return { x, y, width, height };
  }, [nodes]);

  // Rail label positions
  const railLabelPositions = useMemo(() => {
    const topPowerNode = nodes.get("power-top-1");
    const topGroundNode = nodes.get("ground-top-1");
    const bottomPowerNode = nodes.get("power-bottom-1");
    const bottomGroundNode = nodes.get("ground-bottom-1");

    if (
      !topPowerNode ||
      !topGroundNode ||
      !bottomPowerNode ||
      !bottomGroundNode
    ) {
      return [];
    }

    const rightX =
      RENDER.PADDING_X + (BREADBOARD.COLUMNS - 1) * RENDER.NODE_SPACING + 32;

    // Labels directly follow node positions (factory data matches real-world layout)
    return [
      // Left-side labels
      {
        label: "-",
        x: RENDER.PADDING_X - 32,
        y: topGroundNode.canvasPosition.y,
        color: COLORS.GROUND_RAIL,
      },
      {
        label: "+",
        x: RENDER.PADDING_X - 32,
        y: topPowerNode.canvasPosition.y,
        color: COLORS.POWER_RAIL,
      },
      {
        label: "+",
        x: RENDER.PADDING_X - 32,
        y: bottomPowerNode.canvasPosition.y,
        color: COLORS.POWER_RAIL,
      },
      {
        label: "-",
        x: RENDER.PADDING_X - 32,
        y: bottomGroundNode.canvasPosition.y,
        color: COLORS.GROUND_RAIL,
      },
      // Right-side labels (symmetrical)
      {
        label: "-",
        x: rightX,
        y: topGroundNode.canvasPosition.y,
        color: COLORS.GROUND_RAIL,
      },
      {
        label: "+",
        x: rightX,
        y: topPowerNode.canvasPosition.y,
        color: COLORS.POWER_RAIL,
      },
      {
        label: "+",
        x: rightX,
        y: bottomPowerNode.canvasPosition.y,
        color: COLORS.POWER_RAIL,
      },
      {
        label: "-",
        x: rightX,
        y: bottomGroundNode.canvasPosition.y,
        color: COLORS.GROUND_RAIL,
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
      {/* SVG Definitions for filters and gradients */}
      <defs>
        {/* Drop shadow filter for 3D plastic effect */}
        <filter id="boardShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow
            dx="2"
            dy="4"
            stdDeviation="4"
            floodColor={COLORS.BOARD_SHADOW}
            floodOpacity="0.3"
          />
        </filter>

        {/* Inset shadow filter for trench */}
        <filter id="trenchInset" x="-20%" y="-20%" width="140%" height="140%">
          <feOffset dx="0" dy="1" />
          <feGaussianBlur stdDeviation="1" result="shadow" />
          <feComposite in="SourceGraphic" in2="shadow" operator="over" />
        </filter>

        {/* Linear gradient for trench depth effect */}
        <linearGradient id="trenchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={COLORS.CENTER_GAP_SHADOW} />
          <stop offset="20%" stopColor={COLORS.CENTER_GAP} />
          <stop offset="80%" stopColor={COLORS.CENTER_GAP} />
          <stop offset="100%" stopColor={COLORS.CENTER_GAP_HIGHLIGHT} />
        </linearGradient>
      </defs>

      {/* Board background with drop shadow (3D plastic slab) */}
      <rect
        x={4}
        y={4}
        width={boardWidth - 8}
        height={boardHeight - 8}
        fill={COLORS.BOARD_BACKGROUND}
        rx={6}
        ry={6}
        filter="url(#boardShadow)"
      />

      {/* Board top bevel highlight */}
      <rect
        x={4}
        y={4}
        width={boardWidth - 8}
        height={boardHeight - 8}
        fill="none"
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth={1}
        rx={6}
        ry={6}
      />

      {/* Board edge border */}
      <rect
        x={5}
        y={5}
        width={boardWidth - 10}
        height={boardHeight - 10}
        fill="none"
        stroke={COLORS.BOARD_BORDER}
        strokeWidth={1}
        rx={5}
        ry={5}
      />

      {/* Power rail stripes (thin colored lines) */}
      {railStripes.map((stripe) => (
        <RailStripe
          key={stripe.id}
          startX={stripe.startX}
          y={stripe.y}
          width={stripe.width}
          color={stripe.color}
        />
      ))}

      {/* Center trench (physical indentation) */}
      {centerTrench && (
        <g>
          {/* Trench shadow (top edge) */}
          <rect
            x={centerTrench.x}
            y={centerTrench.y}
            width={centerTrench.width}
            height={2}
            fill={COLORS.CENTER_GAP_SHADOW}
            rx={1}
          />

          {/* Trench body with gradient */}
          <rect
            x={centerTrench.x}
            y={centerTrench.y}
            width={centerTrench.width}
            height={centerTrench.height}
            fill="url(#trenchGradient)"
            rx={2}
          />

          {/* Trench inner shadow lines for depth */}
          <line
            x1={centerTrench.x + 2}
            y1={centerTrench.y + 2}
            x2={centerTrench.x + centerTrench.width - 2}
            y2={centerTrench.y + 2}
            stroke={COLORS.CENTER_GAP_SHADOW}
            strokeWidth={0.5}
          />
          <line
            x1={centerTrench.x + 2}
            y1={centerTrench.y + centerTrench.height - 2}
            x2={centerTrench.x + centerTrench.width - 2}
            y2={centerTrench.y + centerTrench.height - 2}
            stroke={COLORS.CENTER_GAP_HIGHLIGHT}
            strokeWidth={0.5}
          />
        </g>
      )}

      {/* Rail labels (silkscreen printed +/-) */}
      {railLabelPositions.map((pos, idx) => (
        <RailLabel
          key={`rail-label-${idx}`}
          x={pos.x}
          y={pos.y}
          label={pos.label}
          color={pos.color}
        />
      ))}

      {/* Row labels - LEFT (A-J silkscreen) */}
      {rowLabels.map(({ row, y }) => (
        <RowLabel key={row} row={row} y={y} />
      ))}

      {/* Row labels - RIGHT (A-J silkscreen, symmetrical) */}
      {rowLabels.map(({ row, y }) => (
        <text
          key={`right-${row}`}
          x={
            RENDER.PADDING_X +
            (BREADBOARD.COLUMNS - 1) * RENDER.NODE_SPACING +
            22
          }
          y={y}
          fill={COLORS.SILKSCREEN_TEXT}
          fontSize="10"
          fontWeight="600"
          fontFamily="Arial, sans-serif"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ userSelect: "none" }}
        >
          {row}
        </text>
      ))}

      {/* Column numbers - TOP (above row J, silkscreen) */}
      {colLabels.map(({ col, x }) => (
        <ColNumber
          key={`top-${col}`}
          col={col}
          x={x}
          y={
            RENDER.PADDING_Y +
            2 * RENDER.NODE_SPACING +
            RENDER.RAIL_GAP +
            RENDER.RAIL_TO_TERMINAL_GAP -
            10
          }
        />
      ))}

      {/* Column numbers - BOTTOM (below row A, silkscreen) */}
      {colLabels.map(({ col, x }) => (
        <ColNumber key={`bot-${col}`} col={col} x={x} y={bottomColY} />
      ))}

      {/* Rail nodes (power/ground holes) */}
      {railNodes.map((node) => (
        <BreadboardNodeComponent
          key={node.id}
          node={node}
          isWireStart={wireStartNodeId === node.id}
          isPlacementTarget={placementPins.includes(node.id)}
          isPositive={positiveNodes.has(node.id)}
          isNegative={negativeNodes.has(node.id)}
          selectedTool={selectedTool}
          onNodeClick={onNodeClick}
        />
      ))}

      {/* Terminal nodes (J-A holes, top-to-bottom) */}
      {terminalNodes.map((node) => (
        <BreadboardNodeComponent
          key={node.id}
          node={node}
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
