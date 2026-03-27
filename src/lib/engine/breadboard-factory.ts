// ============================================
// BREADBOARD FACTORY
// Generates the breadboard node structure with internal connections
// ============================================

import { BreadboardNode, CanvasPosition } from '../types';
import { BREADBOARD, RENDER } from '../constants';

/**
 * Generates a unique node ID
 */
function generateNodeId(row: string, col: number): string {
  return `${row}-${col}`;
}

/**
 * Generates connection group ID for terminal strips
 * Terminal strips are connected vertically in groups of 5 (A-E or F-J for each column)
 */
function getTerminalConnectionGroup(row: string, col: number): string {
  const topRows = BREADBOARD.TERMINAL_ROWS_TOP as readonly string[];
  const isTopSection = topRows.includes(row);
  const section = isTopSection ? 'top' : 'bottom';
  return `terminal-${section}-${col}`;
}

/**
 * Generates connection group ID for power rails
 * Power rails are connected horizontally across all columns
 */
function getRailConnectionGroup(railType: 'power' | 'ground', position: 'top' | 'bottom'): string {
  return `rail-${railType}-${position}`;
}

/**
 * Calculates the canvas position for a terminal node
 */
function getTerminalCanvasPosition(row: string, col: number): CanvasPosition {
  const allRows = [...BREADBOARD.TERMINAL_ROWS_TOP, ...BREADBOARD.TERMINAL_ROWS_BOTTOM];
  const rowIndex = allRows.indexOf(row as typeof allRows[number]);
  const isBottomSection = rowIndex >= 5;
  
  // Calculate X position
  const x = RENDER.PADDING_X + (col - 1) * RENDER.NODE_SPACING;
  
  // Calculate Y position
  // Start after top rails
  let y = RENDER.PADDING_Y + (2 * RENDER.NODE_SPACING) + RENDER.RAIL_GAP + RENDER.RAIL_TO_TERMINAL_GAP;
  
  if (isBottomSection) {
    // Add top terminal section height + gap
    y += (5 * RENDER.NODE_SPACING) + RENDER.SECTION_GAP;
    // Row within bottom section (0-4)
    y += (rowIndex - 5) * RENDER.NODE_SPACING;
  } else {
    // Row within top section (0-4)
    y += rowIndex * RENDER.NODE_SPACING;
  }
  
  return { x, y };
}

/**
 * Calculates the canvas position for a rail node
 */
function getRailCanvasPosition(
  railType: 'power' | 'ground',
  position: 'top' | 'bottom',
  col: number
): CanvasPosition {
  const x = RENDER.PADDING_X + (col - 1) * RENDER.NODE_SPACING;
  
  let y: number;
  
  if (position === 'top') {
    // Real-world MB-102 layout: Ground (-) at top, Power (+) below
    y = RENDER.PADDING_Y + (railType === 'ground' ? 0 : RENDER.NODE_SPACING + RENDER.RAIL_GAP / 2);
  } else {
    // Bottom rails: Ground (-) at top, Power (+) below (same order as top rails)
    const terminalSectionHeight = 5 * RENDER.NODE_SPACING;
    const topContentHeight = RENDER.PADDING_Y + (2 * RENDER.NODE_SPACING) + RENDER.RAIL_GAP + 
                            RENDER.RAIL_TO_TERMINAL_GAP + terminalSectionHeight + RENDER.SECTION_GAP + 
                            terminalSectionHeight + RENDER.RAIL_TO_TERMINAL_GAP;
    y = topContentHeight + (railType === 'ground' ? 0 : RENDER.NODE_SPACING + RENDER.RAIL_GAP / 2);
  }
  
  return { x, y };
}

/**
 * Creates a single terminal node
 */
function createTerminalNode(row: string, col: number): BreadboardNode {
  const topRows = BREADBOARD.TERMINAL_ROWS_TOP as readonly string[];
  const isTopSection = topRows.includes(row);
  
  return {
    id: generateNodeId(row, col),
    position: { row: row.charCodeAt(0) - 65, col }, // A=0, B=1, etc.
    stripType: 'terminal',
    section: isTopSection ? 'top' : 'bottom',
    connectionGroup: getTerminalConnectionGroup(row, col),
    isOccupied: false,
    canvasPosition: getTerminalCanvasPosition(row, col),
  };
}

/**
 * Creates a single rail node
 */
function createRailNode(
  railType: 'power' | 'ground',
  position: 'top' | 'bottom',
  col: number
): BreadboardNode {
  const rowLabel = position === 'top' 
    ? (railType === 'power' ? 'power-top' : 'ground-top')
    : (railType === 'power' ? 'power-bottom' : 'ground-bottom');
    
  return {
    id: `${rowLabel}-${col}`,
    position: { row: railType === 'ground' ? -2 : -1, col },
    stripType: railType === 'power' ? 'power-rail' : 'ground-rail',
    railType,
    connectionGroup: getRailConnectionGroup(railType, position),
    isOccupied: false,
    canvasPosition: getRailCanvasPosition(railType, position, col),
  };
}

/**
 * Generates all breadboard nodes
 */
export function createBreadboardNodes(): Map<string, BreadboardNode> {
  const nodes = new Map<string, BreadboardNode>();
  
  // Create terminal nodes (A-J, columns 1-30)
  const allTerminalRows = [...BREADBOARD.TERMINAL_ROWS_TOP, ...BREADBOARD.TERMINAL_ROWS_BOTTOM];
  
  for (const row of allTerminalRows) {
    for (let col = 1; col <= BREADBOARD.COLUMNS; col++) {
      const node = createTerminalNode(row, col);
      nodes.set(node.id, node);
    }
  }
  
  // Create rail nodes (top and bottom, power and ground)
  for (let col = 1; col <= BREADBOARD.COLUMNS; col++) {
    // Top rails
    const topPower = createRailNode('power', 'top', col);
    const topGround = createRailNode('ground', 'top', col);
    nodes.set(topPower.id, topPower);
    nodes.set(topGround.id, topGround);
    
    // Bottom rails
    const bottomPower = createRailNode('power', 'bottom', col);
    const bottomGround = createRailNode('ground', 'bottom', col);
    nodes.set(bottomPower.id, bottomPower);
    nodes.set(bottomGround.id, bottomGround);
  }
  
  return nodes;
}

/**
 * Gets all nodes in the same connection group (internally connected)
 */
export function getConnectedNodes(
  nodeId: string,
  nodes: Map<string, BreadboardNode>
): BreadboardNode[] {
  const node = nodes.get(nodeId);
  if (!node) return [];
  
  const connectedNodes: BreadboardNode[] = [];
  
  nodes.forEach((n) => {
    if (n.connectionGroup === node.connectionGroup) {
      connectedNodes.push(n);
    }
  });
  
  return connectedNodes;
}

/**
 * Checks if two nodes are internally connected via breadboard traces
 */
export function areNodesInternallyConnected(
  nodeId1: string,
  nodeId2: string,
  nodes: Map<string, BreadboardNode>
): boolean {
  const node1 = nodes.get(nodeId1);
  const node2 = nodes.get(nodeId2);
  
  if (!node1 || !node2) return false;
  
  return node1.connectionGroup === node2.connectionGroup;
}

/**
 * Gets all unique connection groups
 */
export function getConnectionGroups(nodes: Map<string, BreadboardNode>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  
  nodes.forEach((node) => {
    if (!groups.has(node.connectionGroup)) {
      groups.set(node.connectionGroup, []);
    }
    groups.get(node.connectionGroup)!.push(node.id);
  });
  
  return groups;
}

/**
 * Creates 2D grid representation for easy position-based access
 */
export function createNodeGrid(nodes: Map<string, BreadboardNode>): BreadboardNode[][] {
  // This creates a sparse 2D array indexed by visual row position (top-to-bottom)
  // Layout: ground-top, power-top, J-F, E-A, ground-bottom, power-bottom
  const grid: BreadboardNode[][] = [];
  
  // Initialize rows
  for (let i = 0; i < 14; i++) { // 2 top rails + 10 terminals + 2 bottom rails
    grid[i] = [];
  }
  
  nodes.forEach((node) => {
    let rowIndex: number;
    
    if (node.id.startsWith('ground-top')) {
      rowIndex = 0;  // Ground (-) is the topmost row
    } else if (node.id.startsWith('power-top')) {
      rowIndex = 1;  // Power (+) is the second row
    } else if (node.id.startsWith('ground-bottom')) {
      rowIndex = 12; // Ground (-) is above power in bottom section
    } else if (node.id.startsWith('power-bottom')) {
      rowIndex = 13; // Power (+) is the bottommost row
    } else {
      // Terminal node - extract row letter
      const rowLetter = node.id.split('-')[0];
      const allRows = [...BREADBOARD.TERMINAL_ROWS_TOP, ...BREADBOARD.TERMINAL_ROWS_BOTTOM];
      rowIndex = allRows.indexOf(rowLetter as typeof allRows[number]) + 2; // +2 for top rails
    }
    
    // Extract column (1-based in ID, 0-based in array)
    const col = parseInt(node.id.split('-').pop()!, 10) - 1;
    grid[rowIndex][col] = node;
  });
  
  return grid;
}

/**
 * Finds the nearest breadboard node to a given canvas position.
 * Returns null if no node is within the snap tolerance (NODE_SPACING / 2).
 * 
 * @param canvasX - X position in SVG content space
 * @param canvasY - Y position in SVG content space
 * @param nodes - All breadboard nodes
 * @param excludeOccupied - If true, skip nodes that are currently occupied
 */
export function findNearestNode(
  canvasX: number,
  canvasY: number,
  nodes: Map<string, BreadboardNode>,
  excludeOccupied: boolean = false,
): BreadboardNode | null {
  const snapTolerance = RENDER.NODE_SPACING / 2;
  let nearest: BreadboardNode | null = null;
  let minDist = Infinity;
  
  nodes.forEach((node) => {
    if (excludeOccupied && node.isOccupied) return;
    
    const dx = node.canvasPosition.x - canvasX;
    const dy = node.canvasPosition.y - canvasY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < minDist && dist <= snapTolerance) {
      minDist = dist;
      nearest = node;
    }
  });
  
  return nearest;
}
