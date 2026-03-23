// ============================================
// CIRCUIT EVALUATOR ENGINE v3.0
// Proper physics-based graph traversal algorithm
// ============================================
// 
// PHYSICS RULES ENFORCED:
// 1. A circuit is ONLY complete if there's an unbroken loop from Battery+ through
//    components back to Battery-
// 2. Short Circuit Detection: Direct path from + to - WITHOUT passing through load = DANGER
// 3. LED Polarity: Current must flow Anode(+) → Cathode(-), reverse = OPEN circuit
// 4. Breadboard Rules:
//    - Power rails: horizontal connections across all columns
//    - Terminal strips: vertical connections (A-E per column, F-J per column)
//    - NO connection across middle trench (E to F) without wire/component
// ============================================

import {
  BreadboardNode,
  CircuitComponent,
  Wire,
  LEDState,
  BatteryState,
  SwitchState,
  BuzzerState,
  ComponentState,
  PinType,
} from '../types';


// ---- Circuit Status Types ----
export type CircuitStatus = 'incomplete' | 'complete' | 'short-circuit';

export interface SimulationResultV2 {
  status: CircuitStatus;
  isCircuitComplete: boolean;
  activePath: string[];
  powerSourceId: string | null;
  componentStates: Map<string, ComponentState>;
  shortCircuitPath?: string[];
  message: string;
}

// ---- Component Pin Mapping ----
// Maps nodeId -> { componentId, pinType, component }
interface PinMapping {
  componentId: string;
  pinType: PinType;
  component: CircuitComponent;
}

/**
 * Check if a component is a "load" (provides resistance/consumes power)
 */
function isLoadComponent(componentType: string): boolean {
  return ['led', 'resistor', 'buzzer', 'capacitor'].includes(componentType);
}

/**
 * Check if a component conducts electricity in its current state
 */
function componentConducts(component: CircuitComponent): boolean {
  switch (component.type) {
    case 'switch':
      return (component.state as SwitchState).isClosed;
    case 'battery':
      return (component.state as BatteryState).isOn;
    default:
      return true;
  }
}

/**
 * Build a map of nodeId -> pin information for quick lookup
 */
function buildPinMap(
  components: CircuitComponent[],
  nodes: Map<string, BreadboardNode>
): Map<string, PinMapping[]> {
  const pinMap = new Map<string, PinMapping[]>();
  
  for (const component of components) {
    if (component.type === 'battery') continue; // Skip battery in pin map
    
    for (const pin of component.pins) {
      if (!pin.connectedNodeId) continue;
      
      // Get all nodes in the same connection group
      const connectedNodes = getInternallyConnectedNodeIds(pin.connectedNodeId, nodes);
      
      for (const nodeId of connectedNodes) {
        if (!pinMap.has(nodeId)) {
          pinMap.set(nodeId, []);
        }
        pinMap.get(nodeId)!.push({
          componentId: component.id,
          pinType: pin.pinType,
          component,
        });
      }
    }
  }
  
  return pinMap;
}

/**
 * Get all nodes in the same internal connection group
 */
function getInternallyConnectedNodeIds(
  nodeId: string,
  nodes: Map<string, BreadboardNode>
): string[] {
  const node = nodes.get(nodeId);
  if (!node) return [nodeId];
  
  const connected: string[] = [];
  nodes.forEach((n) => {
    if (n.connectionGroup === node.connectionGroup) {
      connected.push(n.id);
    }
  });
  
  return connected;
}

/**
 * Get the "other" pin of a 2-pin component given one pin
 */
function getOtherPin(component: CircuitComponent, currentPinType: PinType): { pinType: PinType; nodeId: string | null } | null {
  const otherPin = component.pins.find(p => p.pinType !== currentPinType);
  if (!otherPin) return null;
  return { pinType: otherPin.pinType, nodeId: otherPin.connectedNodeId };
}

/**
 * Check if current can flow through LED in the given direction
 * Current must enter Anode and exit Cathode
 */
function canCurrentFlowThroughLED(enteringPinType: PinType): boolean {
  // Current MUST enter through anode
  return enteringPinType === 'anode';
}

/**
 * Find battery and its terminal nodes
 */
function findBattery(
  components: CircuitComponent[],
  nodes: Map<string, BreadboardNode>
): {
  battery: CircuitComponent | null;
  positiveNodes: Set<string>;
  negativeNodes: Set<string>;
} {
  const battery = components.find(
    c => c.type === 'battery' && (c.state as BatteryState).isOn
  );
  
  if (!battery) {
    return { battery: null, positiveNodes: new Set(), negativeNodes: new Set() };
  }
  
  const positivePin = battery.pins.find(p => p.pinType === 'positive');
  const negativePin = battery.pins.find(p => p.pinType === 'negative');
  
  const positiveNodes = new Set(
    positivePin?.connectedNodeId
      ? getInternallyConnectedNodeIds(positivePin.connectedNodeId, nodes)
      : []
  );
  const negativeNodes = new Set(
    negativePin?.connectedNodeId
      ? getInternallyConnectedNodeIds(negativePin.connectedNodeId, nodes)
      : []
  );
  
  return { battery, positiveNodes, negativeNodes };
}

/**
 * Build wire adjacency - which nodes are connected by wires
 */
function buildWireAdjacency(
  wires: Wire[],
  nodes: Map<string, BreadboardNode>
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  
  const addEdge = (from: string, to: string) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  };
  
  // Add wire connections
  for (const wire of wires) {
    // Direct wire connection
    addEdge(wire.startNodeId, wire.endNodeId);
    
    // Also connect all nodes in same connection groups
    const startGroup = getInternallyConnectedNodeIds(wire.startNodeId, nodes);
    const endGroup = getInternallyConnectedNodeIds(wire.endNodeId, nodes);
    
    for (const s of startGroup) {
      for (const e of endGroup) {
        addEdge(s, e);
      }
    }
  }
  
  // Add internal breadboard connections
  const processedGroups = new Set<string>();
  nodes.forEach((node) => {
    if (!processedGroups.has(node.connectionGroup)) {
      processedGroups.add(node.connectionGroup);
      const groupNodes = getInternallyConnectedNodeIds(node.id, nodes);
      for (let i = 0; i < groupNodes.length; i++) {
        for (let j = i + 1; j < groupNodes.length; j++) {
          addEdge(groupNodes[i], groupNodes[j]);
        }
      }
    }
  });
  
  return adjacency;
}

/**
 * DFS to find path from positive to negative terminal
 * Tracks: path, whether load was encountered, components traversed
 */
interface PathResult {
  found: boolean;
  path: string[];
  hasLoad: boolean;
  componentsInPath: Set<string>;
  blockedByPolarity: boolean;
}

function findCircuitPath(
  startNodes: Set<string>,
  targetNodes: Set<string>,
  wireAdjacency: Map<string, Set<string>>,
  pinMap: Map<string, PinMapping[]>,
  nodes: Map<string, BreadboardNode>
): PathResult {
  // Track visited states: nodeId + set of components already used
  // This allows finding paths through different components
  
  interface QueueItem {
    nodeId: string;
    path: string[];
    hasLoad: boolean;
    usedComponents: Set<string>;
    visitedNodes: Set<string>;
  }
  
  const queue: QueueItem[] = [];
  
  // Initialize with all start nodes
  for (const startNode of startNodes) {
    queue.push({
      nodeId: startNode,
      path: [startNode],
      hasLoad: false,
      usedComponents: new Set(),
      visitedNodes: new Set([startNode]),
    });
  }
  
  // Track best results
  let bestPathWithLoad: PathResult | null = null;
  let bestPathWithoutLoad: PathResult | null = null;
  let blockedByPolarity = false;
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const { nodeId, path, hasLoad, usedComponents, visitedNodes } = current;
    
    // Check if we reached target
    if (targetNodes.has(nodeId)) {
      const result: PathResult = {
        found: true,
        path,
        hasLoad,
        componentsInPath: usedComponents,
        blockedByPolarity: false,
      };
      
      if (hasLoad && !bestPathWithLoad) {
        bestPathWithLoad = result;
      } else if (!hasLoad && !bestPathWithoutLoad) {
        bestPathWithoutLoad = result;
      }
      
      // Keep searching for better paths
      continue;
    }
    
    // Expand through wires and internal connections
    const wireNeighbors = wireAdjacency.get(nodeId) || new Set();
    
    for (const neighbor of wireNeighbors) {
      if (visitedNodes.has(neighbor)) continue;
      
      const newVisited = new Set(visitedNodes);
      newVisited.add(neighbor);
      
      // Add all nodes in same connection group to visited
      const neighborGroup = getInternallyConnectedNodeIds(neighbor, nodes);
      for (const ng of neighborGroup) {
        newVisited.add(ng);
      }
      
      queue.push({
        nodeId: neighbor,
        path: [...path, neighbor],
        hasLoad,
        usedComponents: new Set(usedComponents),
        visitedNodes: newVisited,
      });
    }
    
    // Expand through components
    const pinsAtNode = pinMap.get(nodeId) || [];
    
    for (const pinInfo of pinsAtNode) {
      const { componentId, pinType, component } = pinInfo;
      
      // Skip if component already used in this path
      if (usedComponents.has(componentId)) continue;
      
      // Skip if component doesn't conduct
      if (!componentConducts(component)) continue;
      
      // For LED, check polarity - current must ENTER through anode
      if (component.type === 'led') {
        if (!canCurrentFlowThroughLED(pinType)) {
          // Current trying to enter through cathode - blocked!
          blockedByPolarity = true;
          continue;
        }
      }
      
      // Get the other end of the component
      const otherPin = getOtherPin(component, pinType);
      if (!otherPin || !otherPin.nodeId) continue;
      
      // Get all nodes connected to the other pin
      const otherNodes = getInternallyConnectedNodeIds(otherPin.nodeId, nodes);
      
      for (const otherNode of otherNodes) {
        if (visitedNodes.has(otherNode)) continue;
        
        const newVisited = new Set(visitedNodes);
        newVisited.add(otherNode);
        
        // Add all nodes in connection group
        for (const on of otherNodes) {
          newVisited.add(on);
        }
        
        const newUsedComponents = new Set(usedComponents);
        newUsedComponents.add(componentId);
        
        const newHasLoad = hasLoad || isLoadComponent(component.type);
        
        queue.push({
          nodeId: otherNode,
          path: [...path, otherNode],
          hasLoad: newHasLoad,
          usedComponents: newUsedComponents,
          visitedNodes: newVisited,
        });
      }
    }
  }
  
  // Return best result - prefer path with load
  if (bestPathWithLoad) {
    return bestPathWithLoad;
  }
  
  if (bestPathWithoutLoad) {
    return bestPathWithoutLoad;
  }
  
  return {
    found: false,
    path: [],
    hasLoad: false,
    componentsInPath: new Set(),
    blockedByPolarity,
  };
}

/**
 * Main circuit evaluation function
 */
export function evaluateCircuit(
  nodes: Map<string, BreadboardNode>,
  components: CircuitComponent[],
  wires: Wire[]
): SimulationResultV2 {
  // Default result - incomplete circuit
  const defaultResult: SimulationResultV2 = {
    status: 'incomplete',
    isCircuitComplete: false,
    activePath: [],
    powerSourceId: null,
    componentStates: new Map(),
    message: 'No complete circuit detected',
  };
  
  // Initialize all component states to default (off)
  components.forEach((component) => {
    if (component.type === 'led') {
      defaultResult.componentStates.set(component.id, {
        ...(component.state as LEDState),
        isLit: false,
      });
    } else if (component.type === 'buzzer') {
      defaultResult.componentStates.set(component.id, {
        ...(component.state as BuzzerState),
        isActive: false,
      });
    } else {
      defaultResult.componentStates.set(component.id, component.state);
    }
  });
  
  // Find battery
  const { battery, positiveNodes, negativeNodes } = findBattery(components, nodes);
  
  if (!battery) {
    defaultResult.message = 'No power source (battery) found';
    return defaultResult;
  }
  
  if (positiveNodes.size === 0 || negativeNodes.size === 0) {
    defaultResult.message = 'Battery not properly connected to breadboard';
    defaultResult.powerSourceId = battery.id;
    return defaultResult;
  }
  
  defaultResult.powerSourceId = battery.id;
  
  // Build data structures
  const pinMap = buildPinMap(components, nodes);
  const wireAdjacency = buildWireAdjacency(wires, nodes);
  
  // Find path from positive to negative
  const pathResult = findCircuitPath(
    positiveNodes,
    negativeNodes,
    wireAdjacency,
    pinMap,
    nodes
  );
  
  // No path found
  if (!pathResult.found) {
    if (pathResult.blockedByPolarity) {
      defaultResult.message = 'Circuit blocked - LED connected with wrong polarity (current cannot enter cathode)';
    } else {
      defaultResult.message = 'Circuit is open - no complete path from + to -';
    }
    return defaultResult;
  }
  
  // Path found but no load - SHORT CIRCUIT!
  if (!pathResult.hasLoad) {
    return {
      status: 'short-circuit',
      isCircuitComplete: false,
      activePath: pathResult.path,
      powerSourceId: battery.id,
      componentStates: new Map(defaultResult.componentStates),
      shortCircuitPath: pathResult.path,
      message: 'SHORT CIRCUIT! Direct path from + to - without any load (LED/resistor)',
    };
  }
  
  // Circuit is complete with proper load!
  const result: SimulationResultV2 = {
    status: 'complete',
    isCircuitComplete: true,
    activePath: pathResult.path,
    powerSourceId: battery.id,
    componentStates: new Map(defaultResult.componentStates),
    message: 'Circuit complete - current flowing',
  };
  
  // Update component states for components in the active path
  for (const componentId of pathResult.componentsInPath) {
    const component = components.find(c => c.id === componentId);
    if (!component) continue;
    
    if (component.type === 'led') {
      result.componentStates.set(component.id, {
        ...(component.state as LEDState),
        isLit: true,
      });
    } else if (component.type === 'buzzer') {
      result.componentStates.set(component.id, {
        ...(component.state as BuzzerState),
        isActive: true,
      });
    }
  }
  
  return result;
}

/**
 * Get all nodes that are part of the active circuit (for highlighting)
 */
export function getActiveNodes(
  path: string[],
  nodes: Map<string, BreadboardNode>
): Set<string> {
  const activeNodes = new Set<string>();
  
  path.forEach((nodeId) => {
    activeNodes.add(nodeId);
    // Also add all internally connected nodes
    getInternallyConnectedNodeIds(nodeId, nodes).forEach(id => activeNodes.add(id));
  });
  
  return activeNodes;
}

/**
 * Validates component placement
 */
export function validateComponentPlacement(
  componentType: string,
  nodeIds: string[],
  nodes: Map<string, BreadboardNode>
): { valid: boolean; reason?: string } {
  for (const nodeId of nodeIds) {
    if (!nodes.has(nodeId)) {
      return { valid: false, reason: `Node ${nodeId} does not exist` };
    }
    
    const node = nodes.get(nodeId)!;
    if (node.isOccupied) {
      return { valid: false, reason: `Node ${nodeId} is already occupied` };
    }
  }
  
  if (nodeIds.length >= 2) {
    const node1 = nodes.get(nodeIds[0])!;
    const node2 = nodes.get(nodeIds[1])!;
    
    if (node1.connectionGroup === node2.connectionGroup) {
      return {
        valid: false,
        reason: 'Component pins cannot be on the same connection strip (short circuit)',
      };
    }
  }
  
  return { valid: true };
}

// Legacy export for backwards compatibility
export function buildCircuitGraph(
  nodes: Map<string, BreadboardNode>,
  _components: CircuitComponent[],
  wires: Wire[]
): Map<string, Set<string>> {
  return buildWireAdjacency(wires, nodes);
}
