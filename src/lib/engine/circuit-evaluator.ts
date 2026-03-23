// ============================================
// CIRCUIT EVALUATOR ENGINE v4.0
// 2-Way Flood Fill Algorithm for Parallel Circuits
// ============================================
// 
// ELECTRICAL REALITY:
// 1. Electricity flows through ALL available paths simultaneously (parallel circuits)
// 2. A component is active if its input touches POSITIVE and output touches NEGATIVE
// 3. Short Circuit: Direct wire path from + to - without any load
// 4. LED Polarity: Anode must be on positive side, Cathode on negative side
// 
// ALGORITHM:
// Step 1: Flood from Battery+ → find all "positiveReachable" nodes
// Step 2: Flood from Battery- → find all "negativeReachable" nodes
// Step 3: For each component, check if pins span both sets
// Step 4: Detect short circuits (wire-only path from + to -)
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
  // Voltage potential sets - nodes reachable from each battery terminal
  positiveReachable: Set<string>;
  negativeReachable: Set<string>;
}

// Maximum iterations for flood fill (safeguard)
const MAX_FLOOD_ITERATIONS = 5000;

/**
 * Build connection group cache for O(1) lookups
 */
function buildConnectionGroupCache(nodes: Map<string, BreadboardNode>): Map<string, string[]> {
  const cache = new Map<string, string[]>();
  const groupToNodes = new Map<string, string[]>();
  
  nodes.forEach((node) => {
    if (!groupToNodes.has(node.connectionGroup)) {
      groupToNodes.set(node.connectionGroup, []);
    }
    groupToNodes.get(node.connectionGroup)!.push(node.id);
  });
  
  nodes.forEach((node) => {
    cache.set(node.id, groupToNodes.get(node.connectionGroup) || [node.id]);
  });
  
  return cache;
}

/**
 * Build wire adjacency map - which nodes are directly connected by wires
 */
function buildWireAdjacency(
  wires: Wire[],
  cache: Map<string, string[]>
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  
  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  };
  
  // Add wire connections (including all nodes in connection groups)
  for (const wire of wires) {
    const startGroup = cache.get(wire.startNodeId) || [wire.startNodeId];
    const endGroup = cache.get(wire.endNodeId) || [wire.endNodeId];
    
    for (const s of startGroup) {
      for (const e of endGroup) {
        addEdge(s, e);
      }
    }
  }
  
  return adjacency;
}

/**
 * Build component adjacency - maps node IDs to components that touch them
 */
interface ComponentConnection {
  component: CircuitComponent;
  pinType: string;
  otherPinNodeIds: string[];
}

function buildComponentAdjacency(
  components: CircuitComponent[],
  cache: Map<string, string[]>
): Map<string, ComponentConnection[]> {
  const adjacency = new Map<string, ComponentConnection[]>();
  
  for (const component of components) {
    if (component.type === 'battery') continue; // Battery handled separately
    
    for (const pin of component.pins) {
      if (!pin.connectedNodeId) continue;
      
      // Find the other pin(s) of this component
      const otherPins = component.pins.filter(p => p.id !== pin.id && p.connectedNodeId);
      const otherPinNodeIds = otherPins.flatMap(p => cache.get(p.connectedNodeId!) || [p.connectedNodeId!]);
      
      // Map all nodes in this pin's connection group to the component
      const pinGroup = cache.get(pin.connectedNodeId) || [pin.connectedNodeId];
      for (const nodeId of pinGroup) {
        if (!adjacency.has(nodeId)) {
          adjacency.set(nodeId, []);
        }
        adjacency.get(nodeId)!.push({
          component,
          pinType: pin.pinType,
          otherPinNodeIds,
        });
      }
    }
  }
  
  return adjacency;
}

/**
 * Check if a component conducts in its current state
 */
function componentConducts(component: CircuitComponent): boolean {
  if (component.type === 'switch') {
    return (component.state as SwitchState).isClosed;
  }
  return true;
}

/**
 * Check if a component is a load (consumes power)
 */
function isLoadComponent(type: string): boolean {
  return ['led', 'resistor', 'buzzer', 'capacitor'].includes(type);
}

/**
 * FLOOD FILL from a starting set of nodes
 * Traverses through wires and conducting components
 * Returns all reachable node IDs
 * 
 * @param direction - 'forward' (from +) respects LED polarity, 'backward' (from -) reverses it
 */
function floodFill(
  startNodes: Set<string>,
  wireAdjacency: Map<string, Set<string>>,
  componentAdjacency: Map<string, ComponentConnection[]>,
  cache: Map<string, string[]>,
  direction: 'forward' | 'backward'
): Set<string> {
  const reachable = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [];
  
  // Initialize with start nodes and their connection groups
  for (const startNode of startNodes) {
    const group = cache.get(startNode) || [startNode];
    for (const nodeId of group) {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        reachable.add(nodeId);
        queue.push(nodeId);
      }
    }
  }
  
  let iterations = 0;
  
  while (queue.length > 0) {
    iterations++;
    if (iterations > MAX_FLOOD_ITERATIONS) {
      console.error('[VBL] Flood fill exceeded max iterations');
      break;
    }
    
    const currentNode = queue.shift()!;
    
    // === TRAVERSE THROUGH WIRES ===
    const wireNeighbors = wireAdjacency.get(currentNode) || new Set();
    for (const neighbor of wireNeighbors) {
      // Mark entire connection group
      const neighborGroup = cache.get(neighbor) || [neighbor];
      for (const nodeId of neighborGroup) {
        if (!visited.has(nodeId)) {
          visited.add(nodeId);
          reachable.add(nodeId);
          queue.push(nodeId);
        }
      }
    }
    
    // === TRAVERSE THROUGH COMPONENTS ===
    const componentConnections = componentAdjacency.get(currentNode) || [];
    for (const conn of componentConnections) {
      const { component, pinType, otherPinNodeIds } = conn;
      
      // Skip non-conducting components (open switches)
      if (!componentConducts(component)) continue;
      
      // LED POLARITY CHECK
      if (component.type === 'led') {
        // Forward (from +): Can only ENTER through anode, EXIT through cathode
        // Backward (from -): Can only ENTER through cathode, EXIT through anode
        if (direction === 'forward' && pinType !== 'anode') continue;
        if (direction === 'backward' && pinType !== 'cathode') continue;
      }
      
      // Add all nodes on the other side of the component
      for (const otherNodeId of otherPinNodeIds) {
        const otherGroup = cache.get(otherNodeId) || [otherNodeId];
        for (const nodeId of otherGroup) {
          if (!visited.has(nodeId)) {
            visited.add(nodeId);
            reachable.add(nodeId);
            queue.push(nodeId);
          }
        }
      }
    }
  }
  
  return reachable;
}

/**
 * Check for SHORT CIRCUIT: Direct wire path from + to - without load
 */
function checkShortCircuit(
  positiveStartNodes: Set<string>,
  negativeStartNodes: Set<string>,
  wireAdjacency: Map<string, Set<string>>,
  cache: Map<string, string[]>
): { isShort: boolean; path: string[] } {
  // BFS through WIRES ONLY (no components) to find direct path
  const visited = new Set<string>();
  const queue: { nodeId: string; path: string[] }[] = [];
  
  // Start from positive nodes
  for (const startNode of positiveStartNodes) {
    const group = cache.get(startNode) || [startNode];
    for (const nodeId of group) {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        queue.push({ nodeId, path: [nodeId] });
      }
    }
  }
  
  let iterations = 0;
  
  while (queue.length > 0) {
    iterations++;
    if (iterations > MAX_FLOOD_ITERATIONS) break;
    
    const { nodeId, path } = queue.shift()!;
    
    // Check if we reached negative terminal via wires only
    if (negativeStartNodes.has(nodeId)) {
      return { isShort: true, path };
    }
    
    // Traverse ONLY through wires (not components)
    const wireNeighbors = wireAdjacency.get(nodeId) || new Set();
    for (const neighbor of wireNeighbors) {
      const neighborGroup = cache.get(neighbor) || [neighbor];
      for (const groupNode of neighborGroup) {
        if (!visited.has(groupNode)) {
          visited.add(groupNode);
          queue.push({ nodeId: groupNode, path: [...path, groupNode] });
        }
      }
    }
  }
  
  return { isShort: false, path: [] };
}

/**
 * Find battery and its terminal node IDs
 */
function findBattery(
  components: CircuitComponent[],
  cache: Map<string, string[]>
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
      ? (cache.get(positivePin.connectedNodeId) || [positivePin.connectedNodeId])
      : []
  );
  const negativeNodes = new Set(
    negativePin?.connectedNodeId
      ? (cache.get(negativePin.connectedNodeId) || [negativePin.connectedNodeId])
      : []
  );
  
  return { battery, positiveNodes, negativeNodes };
}

/**
 * MAIN CIRCUIT EVALUATION - 2-Way Flood Fill Algorithm
 * 
 * This evaluates ALL components simultaneously, supporting parallel circuits.
 */
export function evaluateCircuit(
  nodes: Map<string, BreadboardNode>,
  components: CircuitComponent[],
  wires: Wire[]
): SimulationResultV2 {
  // Default result (empty sets for voltage potential)
  const result: SimulationResultV2 = {
    status: 'incomplete',
    isCircuitComplete: false,
    activePath: [],
    powerSourceId: null,
    componentStates: new Map(),
    message: 'No complete circuit detected',
    positiveReachable: new Set(),
    negativeReachable: new Set(),
  };
  
  // Initialize all component states to OFF
  for (const component of components) {
    if (component.type === 'led') {
      result.componentStates.set(component.id, {
        ...(component.state as LEDState),
        isLit: false,
      });
    } else if (component.type === 'buzzer') {
      result.componentStates.set(component.id, {
        ...(component.state as BuzzerState),
        isActive: false,
      });
    } else {
      result.componentStates.set(component.id, component.state);
    }
  }
  
  // Build caches
  const connectionCache = buildConnectionGroupCache(nodes);
  const wireAdjacency = buildWireAdjacency(wires, connectionCache);
  const componentAdjacency = buildComponentAdjacency(components, connectionCache);
  
  // Find battery
  const { battery, positiveNodes: batteryPositive, negativeNodes: batteryNegative } = 
    findBattery(components, connectionCache);
  
  if (!battery) {
    result.message = 'No power source (battery) found';
    return result;
  }
  
  result.powerSourceId = battery.id;
  
  if (batteryPositive.size === 0 || batteryNegative.size === 0) {
    result.message = 'Battery not properly connected to breadboard';
    return result;
  }
  
  // === STEP 1: Check for SHORT CIRCUIT (wire-only path from + to -) ===
  const shortCircuitCheck = checkShortCircuit(
    batteryPositive,
    batteryNegative,
    wireAdjacency,
    connectionCache
  );
  
  if (shortCircuitCheck.isShort) {
    return {
      status: 'short-circuit',
      isCircuitComplete: false,
      activePath: shortCircuitCheck.path,
      powerSourceId: battery.id,
      componentStates: result.componentStates,
      shortCircuitPath: shortCircuitCheck.path,
      message: 'SHORT CIRCUIT! Direct wire path from + to - without any load',
      positiveReachable: batteryPositive,
      negativeReachable: batteryNegative,
    };
  }
  
  // === STEP 2: FLOOD FILL from POSITIVE (forward direction) ===
  const positiveReachable = floodFill(
    batteryPositive,
    wireAdjacency,
    componentAdjacency,
    connectionCache,
    'forward'
  );
  
  // === STEP 3: FLOOD FILL from NEGATIVE (backward direction) ===
  const negativeReachable = floodFill(
    batteryNegative,
    wireAdjacency,
    componentAdjacency,
    connectionCache,
    'backward'
  );
  
  // === STEP 4: EVALUATE EACH COMPONENT ===
  // A component is ACTIVE if:
  // - For LED: Anode is in positiveReachable AND Cathode is in negativeReachable
  // - For other components: One pin in positiveReachable AND other pin in negativeReachable
  
  let hasActiveLoad = false;
  const activeComponentIds: string[] = [];
  const allActiveNodes = new Set<string>();
  
  for (const component of components) {
    if (component.type === 'battery') continue;
    if (!componentConducts(component)) continue;
    
    const pins = component.pins.filter(p => p.connectedNodeId);
    if (pins.length < 2) continue;
    
    let isActive = false;
    
    if (component.type === 'led') {
      // LED: Check polarity - anode must be on positive side, cathode on negative
      const anodePin = pins.find(p => p.pinType === 'anode');
      const cathodePin = pins.find(p => p.pinType === 'cathode');
      
      if (anodePin?.connectedNodeId && cathodePin?.connectedNodeId) {
        const anodeGroup = connectionCache.get(anodePin.connectedNodeId) || [anodePin.connectedNodeId];
        const cathodeGroup = connectionCache.get(cathodePin.connectedNodeId) || [cathodePin.connectedNodeId];
        
        const anodeOnPositive = anodeGroup.some(n => positiveReachable.has(n));
        const cathodeOnNegative = cathodeGroup.some(n => negativeReachable.has(n));
        
        isActive = anodeOnPositive && cathodeOnNegative;
      }
    } else {
      // Other 2-pin components: One pin on positive, one on negative
      const pin1 = pins[0];
      const pin2 = pins[1];
      
      if (pin1.connectedNodeId && pin2.connectedNodeId) {
        const pin1Group = connectionCache.get(pin1.connectedNodeId) || [pin1.connectedNodeId];
        const pin2Group = connectionCache.get(pin2.connectedNodeId) || [pin2.connectedNodeId];
        
        const pin1OnPositive = pin1Group.some(n => positiveReachable.has(n));
        const pin1OnNegative = pin1Group.some(n => negativeReachable.has(n));
        const pin2OnPositive = pin2Group.some(n => positiveReachable.has(n));
        const pin2OnNegative = pin2Group.some(n => negativeReachable.has(n));
        
        // Component is active if pins span both power domains
        isActive = (pin1OnPositive && pin2OnNegative) || (pin1OnNegative && pin2OnPositive);
      }
    }
    
    if (isActive) {
      activeComponentIds.push(component.id);
      
      // Add component's nodes to active set
      for (const pin of pins) {
        if (pin.connectedNodeId) {
          const group = connectionCache.get(pin.connectedNodeId) || [pin.connectedNodeId];
          group.forEach(n => allActiveNodes.add(n));
        }
      }
      
      // Update component state
      if (component.type === 'led') {
        result.componentStates.set(component.id, {
          ...(component.state as LEDState),
          isLit: true,
        });
        hasActiveLoad = true;
      } else if (component.type === 'buzzer') {
        result.componentStates.set(component.id, {
          ...(component.state as BuzzerState),
          isActive: true,
        });
        hasActiveLoad = true;
      } else if (isLoadComponent(component.type)) {
        hasActiveLoad = true;
      }
    }
  }
  
  // === STEP 5: DETERMINE CIRCUIT STATUS ===
  if (hasActiveLoad) {
    // Add all nodes from both flood fills to active path (for highlighting)
    positiveReachable.forEach(n => allActiveNodes.add(n));
    negativeReachable.forEach(n => allActiveNodes.add(n));
    
    return {
      status: 'complete',
      isCircuitComplete: true,
      activePath: Array.from(allActiveNodes),
      powerSourceId: battery.id,
      componentStates: result.componentStates,
      message: `Circuit complete - ${activeComponentIds.length} component(s) active`,
      positiveReachable,
      negativeReachable,
    };
  }
  
  // No active loads found - still include voltage potential for visualization
  result.positiveReachable = positiveReachable;
  result.negativeReachable = negativeReachable;
  result.message = 'Circuit is open - no complete path through any load';
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
  const cache = buildConnectionGroupCache(nodes);
  
  for (const nodeId of path) {
    activeNodes.add(nodeId);
    const group = cache.get(nodeId) || [];
    group.forEach(id => activeNodes.add(id));
  }
  
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

/**
 * Legacy export for backwards compatibility
 */
export function buildCircuitGraph(
  nodes: Map<string, BreadboardNode>,
  _components: CircuitComponent[],
  wires: Wire[]
): Map<string, Set<string>> {
  const cache = buildConnectionGroupCache(nodes);
  return buildWireAdjacency(wires, cache);
}
