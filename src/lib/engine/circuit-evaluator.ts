// ============================================
// CIRCUIT EVALUATOR ENGINE v6.0
// Trait-Driven 2-Way Flood Fill with Multi-Pass Stabilization
// Supports Transistors (NPN/PNP) as Dynamic Switches
// ============================================
// 
// ELECTRICAL REALITY:
// 1. Electricity flows through ALL available paths simultaneously (parallel circuits)
// 2. A component is active if its input touches POSITIVE and output touches NEGATIVE
// 3. Short Circuit: Direct wire path from + to - without any load
// 4. Polarized components only allow flow in one direction (Anode→Cathode)
// 
// ALGORITHM:
// Step 1: Flood from Battery+ → find all "positiveReachable" nodes
// Step 2: Flood from Battery- → find all "negativeReachable" nodes
// Step 3: For each component, check if pins span both sets
// Step 4: Detect short circuits (wire-only path from + to -)
//
// TRAIT-DRIVEN DESIGN (AGENTS.md Mandate):
// Components are evaluated PURELY by their universal traits (isLoad, isPolarized,
// isConductive) from COMPONENT_DEFINITIONS — NEVER by hardcoded type strings.
// This ensures any new component added to the dictionary works automatically.
// ============================================

import {
  BreadboardNode,
  CircuitComponent,
  Wire,
  ComponentState,
  ComponentDefinition,
} from '../types';
import { COMPONENT_DEFINITIONS, MAX_EVALUATION_STEPS } from '../constants';

// ---- Trait Lookup Helper ----
// Returns the universal definition for a given component type.
// Falls back to a safe default if the type is unknown.
const FALLBACK_DEFINITION: ComponentDefinition = {
  type: 'unknown' as never,
  name: 'Unknown',
  description: '',
  pinCount: 2,
  pinTypes: ['terminal-1', 'terminal-2'],
  defaultState: {},
  icon: '?',
  isLoad: false,
  isPolarized: false,
  isConductive: true, // Safe default: allows current through
  isPowerSource: false, // Unknown components are not power sources
  category: 'passive', // Safe default: treat as passive component
  isToggleable: false,
  isTimed: false,
  transistorType: null,
  hasUserColor: false,
};

function getDefinition(type: string): ComponentDefinition {
  return COMPONENT_DEFINITIONS[type] ?? FALLBACK_DEFINITION;
}

// ---- Pin Type Helpers (Trait-Driven) ----
// Determines if a pin type is a "positive entry" (anode, positive terminal, collector)
function isPositiveEntryPin(pinType: string): boolean {
  return pinType === 'anode' || pinType === 'positive' || pinType === 'collector';
}

// Determines if a pin type is a "negative entry" (cathode, negative terminal, emitter)
function isNegativeEntryPin(pinType: string): boolean {
  return pinType === 'cathode' || pinType === 'negative' || pinType === 'emitter';
}

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
    // Skip power sources (batteries) - they are handled separately as flood fill origins
    // Trait-driven: Power sources have isLoad=false, isPolarized=true, isConductive=true
    // but are distinguished by having 'positive'/'negative' pins AND providing voltage
    if (isPowerSource(component)) continue;
    
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
 * Trait-driven check: Is this component a power source?
 * Uses the explicit `isPowerSource` trait from COMPONENT_DEFINITIONS.
 */
function isPowerSource(component: CircuitComponent): boolean {
  const def = getDefinition(component.type);
  return def.isPowerSource === true;
}

/**
 * Trait-driven check: Is this power source currently ON?
 * Checks the `isOn` state property for power sources.
 */
function isPowerSourceActive(component: CircuitComponent): boolean {
  if (!isPowerSource(component)) return false;
  const state = component.state as Record<string, unknown>;
  // Default to ON if isOn is not explicitly set to false
  return state.isOn !== false;
}

/**
 * Check if a component conducts in its current state.
 * Uses the universal `isConductive` trait from COMPONENT_DEFINITIONS.
 * 
 * TRAIT LOGIC:
 * - If isConductive=false → never conducts (open circuit component like LED body)
 * - If isConductive=true → conducts, but may have conditional state
 *   - If component has 'isClosed' state → only conducts when isClosed=true (switches)
 *   - Otherwise → always conducts
 * 
 * TRANSISTOR LOGIC (requires voltage context from current flood-fill pass):
 * - NPN: Conducts (C→E) if positiveReachable.has(baseNodeId)
 * - PNP: Conducts (E→C) if negativeReachable.has(baseNodeId)
 */
function componentConducts(
  component: CircuitComponent,
  cache: Map<string, string[]>,
  positiveReachable?: Set<string>,
  negativeReachable?: Set<string>
): boolean {
  const def = getDefinition(component.type);
  
  // ---- TRANSISTOR CONDUCTIVITY (Dynamic Switching) ----
  // Transistors have isConductive=false in their definition, but can
  // conduct DYNAMICALLY when their base pin is at the correct voltage.
  // Uses trait-driven check via transistorType instead of hardcoded type strings.
  if (def.transistorType) {
    // Without voltage context (first pass), transistors don't conduct
    if (!positiveReachable || !negativeReachable) return false;
    
    const basePin = component.pins.find(p => p.pinType === 'base');
    if (!basePin?.connectedNodeId) return false;
    
    const baseGroup = cache.get(basePin.connectedNodeId) || [basePin.connectedNodeId];
    
    if (def.transistorType === 'npn') {
      // NPN: Base must be POSITIVE → Collector-to-Emitter conducts
      return baseGroup.some(n => positiveReachable.has(n));
    } else {
      // PNP: Base must be NEGATIVE → Emitter-to-Collector conducts
      return baseGroup.some(n => negativeReachable.has(n));
    }
  }
  
  // Non-conductive components never pass current
  if (!def.isConductive) return false;
  
  // Conductive components may have conditional conductivity (switches)
  const state = component.state as Record<string, unknown>;
  if ('isClosed' in state) {
    return state.isClosed === true;
  }
  
  // Default: conductive components conduct
  return true;
}

/**
 * FLOOD FILL from a starting set of nodes
 * Traverses through wires and conducting components
 * Returns all reachable node IDs
 * 
 * @param direction - 'forward' (from +) respects polarity, 'backward' (from -) reverses it
 * @param positiveCtx - Current positiveReachable set (for transistor base checks)
 * @param negativeCtx - Current negativeReachable set (for transistor base checks)
 */
function floodFill(
  startNodes: Set<string>,
  wireAdjacency: Map<string, Set<string>>,
  componentAdjacency: Map<string, ComponentConnection[]>,
  cache: Map<string, string[]>,
  direction: 'forward' | 'backward',
  positiveCtx?: Set<string>,
  negativeCtx?: Set<string>
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
    if (iterations > MAX_EVALUATION_STEPS) {
      console.warn(
        `[VBL] Evaluation halted at ${MAX_EVALUATION_STEPS} steps - possible infinite loop or excessively large circuit.`
      );
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
      
      // Skip non-conducting components (open switches, inactive transistors, etc.)
      if (!componentConducts(component, cache, positiveCtx, negativeCtx)) continue;
      
      // POLARITY CHECK (trait-driven: applies to any isPolarized component)
      const def = getDefinition(component.type);
      if (def.isPolarized) {
        // Forward (from +): Can only ENTER through positive-entry pins (anode/positive)
        // Backward (from -): Can only ENTER through negative-entry pins (cathode/negative)
        const isPositiveEntry = isPositiveEntryPin(pinType);
        const isNegativeEntry = isNegativeEntryPin(pinType);
        
        if (direction === 'forward' && !isPositiveEntry) continue;
        if (direction === 'backward' && !isNegativeEntry) continue;
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
    if (iterations > MAX_EVALUATION_STEPS) {
      console.warn(
        `[VBL] Short-circuit check halted at ${MAX_EVALUATION_STEPS} steps - possible infinite loop or excessively large circuit.`
      );
      break;
    }
    
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
 * Find active power source and its terminal node IDs (trait-driven)
 */
function findActivePowerSource(
  components: CircuitComponent[],
  cache: Map<string, string[]>
): {
  powerSource: CircuitComponent | null;
  positiveNodes: Set<string>;
  negativeNodes: Set<string>;
} {
  // Find first active power source
  const powerSource = components.find(c => isPowerSourceActive(c));

  if (!powerSource) {
    return { powerSource: null, positiveNodes: new Set(), negativeNodes: new Set() };
  }
  
  // Find positive and negative terminals (trait-driven by pin type)
  const positivePin = powerSource.pins.find(p => isPositiveEntryPin(p.pinType));
  const negativePin = powerSource.pins.find(p => isNegativeEntryPin(p.pinType));

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

  return { powerSource, positiveNodes, negativeNodes };
}

/**
 * MAIN CIRCUIT EVALUATION - 2-Way Flood Fill Algorithm
 * 
 * This evaluates ALL components simultaneously, supporting parallel circuits.
 * Uses TRAIT-DRIVEN logic exclusively - no hardcoded component types.
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
  
  // Initialize all component states to OFF (trait-driven)
  for (const component of components) {
    const def = getDefinition(component.type);
    if (def.isLoad) {
      // Loads start de-activated: merge default off-state over current state
      const offState: Record<string, unknown> = { ...component.state as Record<string, unknown> };
      if ('isLit' in offState) offState.isLit = false;
      if ('isActive' in offState) offState.isActive = false;
      result.componentStates.set(component.id, offState as ComponentState);
    } else {
      result.componentStates.set(component.id, component.state);
    }
  }
  
  // Build caches
  const connectionCache = buildConnectionGroupCache(nodes);
  const wireAdjacency = buildWireAdjacency(wires, connectionCache);
  const componentAdjacency = buildComponentAdjacency(components, connectionCache);
  
  // Find active power source (trait-driven)
  const { powerSource, positiveNodes: batteryPositive, negativeNodes: batteryNegative } = 
    findActivePowerSource(components, connectionCache);
  
  if (!powerSource) {
    result.message = 'No active power source found';
    return result;
  }
  
  result.powerSourceId = powerSource.id;
  
  if (batteryPositive.size === 0 || batteryNegative.size === 0) {
    result.message = 'Power source not properly connected to breadboard';
    return result;
  }
  
  // === CREATE ISOLATED SEED SETS (STRICT IMMUTABILITY) ===
  // CRITICAL: We must NEVER mutate batteryPositive/batteryNegative directly.
  // Create fresh copies for conditional source injection (555 OUT pin).
  const initialPositiveSeeds = new Set(batteryPositive);
  const initialNegativeSeeds = new Set(batteryNegative);
  
  // === TIMED COMPONENT OUTPUT INJECTION (PUSH-PULL) ===
  // Uses trait-driven check via isTimed instead of hardcoded type strings.
  // Real 555 output stage is a push-pull amplifier:
  //   clockState === true  → OUT sources current (positive seed)
  //   clockState === false → OUT sinks current (negative seed), only if IC is powered
  // Power gating (VCC/GND check) is handled by tick() — here we just inject the signal.
  for (const comp of components) {
    const compDef = getDefinition(comp.type);
    if (!compDef.isTimed) continue;
    
    const state = comp.state as Record<string, unknown>;
    const outPin = comp.pins.find(p => p.pinType === 'ic-out');
    if (!outPin?.connectedNodeId) continue;
    
    const outGroup = connectionCache.get(outPin.connectedNodeId) || [outPin.connectedNodeId];
    
    if (state.clockState === true) {
      // HIGH: OUT pin sources current → inject into positive seeds
      outGroup.forEach(n => initialPositiveSeeds.add(n));
    } else if (state.clockState === false) {
      // LOW: OUT pin sinks current → inject into negative seeds
      // Power gating is handled upstream by tick() — only toggles clockState when VCC/GND connected
      outGroup.forEach(n => initialNegativeSeeds.add(n));
    }
  }
  
  // === STEP 1: Check for SHORT CIRCUIT (wire-only path from + to -) ===
  const shortCircuitCheck = checkShortCircuit(
    initialPositiveSeeds,
    initialNegativeSeeds,
    wireAdjacency,
    connectionCache
  );
  
  if (shortCircuitCheck.isShort) {
    return {
      status: 'short-circuit',
      isCircuitComplete: false,
      activePath: shortCircuitCheck.path,
      powerSourceId: powerSource.id,
      componentStates: result.componentStates,
      shortCircuitPath: shortCircuitCheck.path,
      message: 'SHORT CIRCUIT! Direct wire path from + to - without any load',
      positiveReachable: batteryPositive,
      negativeReachable: batteryNegative,
    };
  }
  
  // === STEP 2 & 3: MULTI-PASS FLOOD FILL WITH STABILIZATION ===
  // Transistors create a chicken-and-egg problem: their conductivity depends
  // on voltage state that is computed BY the flood-fill. We solve this by
  // iterating until the reachable sets stabilize (no new nodes energized).
  let positiveReachable = new Set<string>();
  let negativeReachable = new Set<string>();
  const MAX_STABILIZATION_PASSES = 10;
  
  for (let pass = 0; pass < MAX_STABILIZATION_PASSES; pass++) {
    // Flood from POSITIVE (forward direction) — passing current context for transistor checks
    const newPositive = floodFill(
      initialPositiveSeeds,
      wireAdjacency,
      componentAdjacency,
      connectionCache,
      'forward',
      positiveReachable,  // Previous pass context
      negativeReachable,
    );
    
    // Flood from NEGATIVE (backward direction)
    const newNegative = floodFill(
      initialNegativeSeeds,
      wireAdjacency,
      componentAdjacency,
      connectionCache,
      'backward',
      newPositive,         // Use UPDATED positive set for PNP base checks
      negativeReachable,
    );
    
    // Check if sets have stabilized (no new nodes energized)
    const hasChanged = newPositive.size !== positiveReachable.size ||
                       newNegative.size !== negativeReachable.size;
    
    positiveReachable = newPositive;
    negativeReachable = newNegative;
    
    if (!hasChanged) break; // Stable — no transistors changed state
  }
  
  // === STEP 4: EVALUATE EACH COMPONENT (Trait-Driven) ===
  let hasActiveLoad = false;
  const activeComponentIds: string[] = [];
  const allActiveNodes = new Set<string>();
  
  for (const component of components) {
    // Skip power sources
    if (isPowerSource(component)) continue;
    
    // Skip dynamically non-conducting components (e.g., open switches)
    // NOTE: We DO evaluate loads with isConductive=false (LEDs, resistors) because
    // they can still be "active" based on voltage potential - isConductive only
    // affects flood-fill traversal, not activation evaluation.
    const def = getDefinition(component.type);
    if (def.isConductive && !componentConducts(component, connectionCache, positiveReachable, negativeReachable)) continue;
    
    const pins = component.pins.filter(p => p.connectedNodeId);
    if (pins.length < 2) continue;
    
    let isActive = false;
    const compDef = getDefinition(component.type);

    if (compDef.isPolarized) {
      // Polarized component: positive-entry pin must be on positive side,
      // negative-entry pin on negative side
      const positivePin = pins.find(p => isPositiveEntryPin(p.pinType));
      const negativePin = pins.find(p => isNegativeEntryPin(p.pinType));
      
      if (positivePin?.connectedNodeId && negativePin?.connectedNodeId) {
        const posGroup = connectionCache.get(positivePin.connectedNodeId) || [positivePin.connectedNodeId];
        const negGroup = connectionCache.get(negativePin.connectedNodeId) || [negativePin.connectedNodeId];
        
        const posOnPositive = posGroup.some(n => positiveReachable.has(n));
        const negOnNegative = negGroup.some(n => negativeReachable.has(n));
        
        isActive = posOnPositive && negOnNegative;
      }
    } else {
      // Non-polarized component: pins can be in any orientation
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
      
      // Update component state (trait-driven)
      if (compDef.isLoad) {
        hasActiveLoad = true;
        // Activate component: merge active state over current state
        const activeState: Record<string, unknown> = { ...component.state as Record<string, unknown> };
        if ('isLit' in activeState) activeState.isLit = true;
        if ('isActive' in activeState) activeState.isActive = true;
        result.componentStates.set(component.id, activeState as ComponentState);
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
      powerSourceId: powerSource.id,
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
