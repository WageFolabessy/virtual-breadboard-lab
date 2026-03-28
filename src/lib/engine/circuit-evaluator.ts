// ============================================
// CIRCUIT EVALUATOR ENGINE v7.1
// Trait-Driven 2-Way Flood Fill with Strong/Weak Current Tracking
// + Pull-Down/Pull-Up Override Resolution
// Supports Transistors (NPN/PNP) as Dynamic Switches
// ============================================
// 
// ELECTRICAL REALITY:
// 1. Electricity flows through ALL available paths simultaneously (parallel circuits)
// 2. A component is active if its input touches POSITIVE and output touches NEGATIVE
// 3. Short Circuit: Direct STRONG path from + to - without any load
// 4. Polarized components only allow flow in one direction (Anode→Cathode)
// 
// STRONG vs WEAK CURRENT MODEL (v7.0):
// - STRONG current: Flows through wires, closed switches, batteries (no resistance)
// - WEAK current: Flows through resistors (current-limiting components)
// - Short Circuit Rule: ONLY triggered when strongPositive ∩ strongNegative ≠ ∅
//   (Resistive bridges are SAFE - weak current prevents dead shorts)
// - Load Activation: Components activate if ANY current (strong OR weak) reaches both sides
//
// PULL-DOWN/PULL-UP OVERRIDE (v7.1):
// - Strong connections overwhelm weak connections of opposite polarity
// - If strongNegative ∩ weakPositive → node is pulled to GND (remove from weakPositive)
// - If strongPositive ∩ weakNegative → node is pulled to VCC (remove from weakNegative)
// - This correctly handles bypass circuits where switches "steal" current from LEDs
// 
// ALGORITHM:
// Step 1: Flood from Battery+ → find {strongPositive, weakPositive} nodes
// Step 2: Flood from Battery- → find {strongNegative, weakNegative} nodes
// Step 3: Short circuit check: strongPositive ∩ strongNegative = dead short
// Step 4: Strong override: annihilate weak nodes pulled to opposite polarity
// Step 5: For each component, check if pins span resolved positive AND negative sets
//
// TRAIT-DRIVEN DESIGN (AGENTS.md Mandate):
// Components are evaluated PURELY by their universal traits (isLoad, isPolarized,
// isConductive, isCurrentLimiting) from COMPONENT_DEFINITIONS — NEVER by hardcoded type strings.
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
  isCurrentLimiting: false, // Unknown components do not limit current
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

// Current strength tracking for Strong vs Weak current model
export type CurrentStrength = 'strong' | 'weak';

// Result type for floodFill - tracks both strong and weak reachable nodes
export interface FloodFillResult {
  strong: Set<string>;
  weak: Set<string>;
}

export interface SimulationResultV2 {
  status: CircuitStatus;
  isCircuitComplete: boolean;
  activePath: string[];
  powerSourceId: string | null;
  componentStates: Map<string, ComponentState>;
  shortCircuitPath?: string[];
  message: string;
  // Voltage potential sets - nodes reachable from each battery terminal
  // Combined (strong ∪ weak) for backwards compatibility and activation checks
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
  negativeReachable?: Set<string>,
  transistorState?: Map<string, boolean>
): boolean {
  const def = getDefinition(component.type);
  
  // ---- TRANSISTOR CONDUCTIVITY (Dynamic Switching) ----
  if (def.transistorType) {
    if (transistorState) {
      return transistorState.get(component.id) || false;
    }
    // Fallback if no explicit state provided (should not happen in v7.3)
    return false;
  }
  
  // Non-conductive components never pass current
  if (!def.isConductive) return false;
  
  // Conductive components may have conditional conductivity (switches)
  const state = component.state as Record<string, unknown>;
  if ('isClosed' in state) {
    return state.isClosed === true;
  }
  
  // Tactile button: always conducts (paired pins are permanently shorted).
  // Cross-pair routing is handled in floodFill, not here.
  // This ensures the component is never skipped during traversal.
  
  // Default: conductive components conduct
  return true;
}

/**
 * Check if a component is a current-limiting (resistive) element.
 * When current flows through these components, it becomes "weak" current.
 * This is used for the Strong vs Weak current model in short circuit detection.
 *
 * TRAIT-DRIVEN: Uses the `isCurrentLimiting` trait from COMPONENT_DEFINITIONS.
 * Any new component with this trait set to true will automatically be recognized.
 */
function isCurrentLimitingComponent(component: CircuitComponent): boolean {
  const def = getDefinition(component.type);
  return def.isCurrentLimiting === true;
}

/**
 * FLOOD FILL from a starting set of nodes (v7.0 - Strong/Weak Current Tracking)
 * Traverses through wires and conducting components
 * Returns { strong: Set<string>, weak: Set<string> } for reachable nodes
 * 
 * STRONG vs WEAK CURRENT MODEL:
 * - Current starts as STRONG from battery terminals
 * - Wires and closed switches PRESERVE current strength
 * - Resistors DOWNGRADE current from strong → weak
 * - Weak current stays weak through additional resistors (no progressive weakening)
 * 
 * @param direction - 'forward' (from +) respects polarity, 'backward' (from -) reverses it
 * @param positiveCtx - Current positiveReachable set (for transistor base checks)
 * @param negativeCtx - Current negativeReachable set (for transistor base checks)
 * @param initialStrength - Starting current strength ('strong' by default)
 */
function floodFill(
  startNodes: Set<string>,
  wireAdjacency: Map<string, Set<string>>,
  componentAdjacency: Map<string, ComponentConnection[]>,
  cache: Map<string, string[]>,
  direction: 'forward' | 'backward',
  positiveCtx?: Set<string>,
  negativeCtx?: Set<string>,
  initialStrength: CurrentStrength = 'strong',
  oppositeStrongNodes?: Set<string>,
  transistorState?: Map<string, boolean>
): FloodFillResult {
  // Track strong and weak reachable nodes separately
  const strongReachable = new Set<string>();
  const weakReachable = new Set<string>();
  
  // Track visited nodes AND their best strength level to handle reconvergent paths
  // A node can be upgraded from weak to strong if a strong path reaches it later
  const nodeStrength = new Map<string, CurrentStrength>();
  
  // BFS queue: [nodeId, currentStrength]
  const queue: Array<{ nodeId: string; strength: CurrentStrength }> = [];
  
  // Helper to add a node with given strength
  const addNode = (nodeId: string, strength: CurrentStrength): boolean => {
    const existingStrength = nodeStrength.get(nodeId);
    
    // If node not visited, or if we have stronger current than before
    if (!existingStrength || (existingStrength === 'weak' && strength === 'strong')) {
      nodeStrength.set(nodeId, strength);
      
      // Update the appropriate reachable set
      if (strength === 'strong') {
        strongReachable.add(nodeId);
        weakReachable.delete(nodeId); // Upgrade from weak to strong
      } else {
        // Only add to weak if not already strong
        if (!strongReachable.has(nodeId)) {
          weakReachable.add(nodeId);
        }
      }
      return true; // Node was added/upgraded, should process
    }
    return false; // Already visited with same or better strength
  };
  
  // Initialize with start nodes and their connection groups
  for (const startNode of startNodes) {
    const group = cache.get(startNode) || [startNode];
    for (const nodeId of group) {
      if (addNode(nodeId, initialStrength)) {
        queue.push({ nodeId, strength: initialStrength });
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
    
    const { nodeId: currentNode, strength: currentStrength } = queue.shift()!;
    
    // NEW ALGORITHM (v7.2): Sink all current into strong nodes of the opposite polarity.
    // This prevents weak current from falsely propagating downstream past a short to ground/VCC.
    if (oppositeStrongNodes && oppositeStrongNodes.has(currentNode)) {
      continue;
    }
    
    // === TRAVERSE THROUGH WIRES ===
    // Wires PRESERVE current strength (strong stays strong, weak stays weak)
    const wireNeighbors = wireAdjacency.get(currentNode) || new Set();
    for (const neighbor of wireNeighbors) {
      const neighborGroup = cache.get(neighbor) || [neighbor];
      for (const nodeId of neighborGroup) {
        if (addNode(nodeId, currentStrength)) {
          queue.push({ nodeId, strength: currentStrength });
        }
      }
    }
    
    // === TRAVERSE THROUGH COMPONENTS ===
    const componentConnections = componentAdjacency.get(currentNode) || [];
    for (const conn of componentConnections) {
      const { component, pinType, otherPinNodeIds } = conn;
      
      // Skip non-conducting components (open switches, inactive transistors, etc.)
      if (!componentConducts(component, cache, positiveCtx, negativeCtx, transistorState)) continue;
      
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
      
      // CURRENT STRENGTH DOWNGRADE: Resistors convert strong → weak
      // Weak current stays weak (no progressive weakening in this model)
      const outputStrength: CurrentStrength = isCurrentLimitingComponent(component) 
        ? 'weak' 
        : currentStrength;
      
      // ---- TACTILE BUTTON PAIRED-PIN ROUTING ----
      // Physical wiring: Left pair (tb-top-left ↔ tb-bottom-left) permanently shorted.
      //                  Right pair (tb-top-right ↔ tb-bottom-right) permanently shorted.
      //                  Cross-pair (left ↔ right) only when isActive === true.
      if (component.pins.length === 4 && component.pins[0]?.pinType === 'tb-top-left') {
        const isLeftPin = pinType === 'tb-top-left' || pinType === 'tb-bottom-left';
        const isRightPin = pinType === 'tb-top-right' || pinType === 'tb-bottom-right';
        const btnState = component.state as Record<string, unknown>;
        const isActive = btnState.isActive === true;
        
        // Compute which pins are reachable from the current entry pin
        const reachablePinTypes: string[] = [];
        if (isLeftPin) {
          // Paired pin on the same side (always shorted)
          reachablePinTypes.push(pinType === 'tb-top-left' ? 'tb-bottom-left' : 'tb-top-left');
          // Cross-pair (only when pressed)
          if (isActive) {
            reachablePinTypes.push('tb-top-right', 'tb-bottom-right');
          }
        } else if (isRightPin) {
          reachablePinTypes.push(pinType === 'tb-top-right' ? 'tb-bottom-right' : 'tb-top-right');
          if (isActive) {
            reachablePinTypes.push('tb-top-left', 'tb-bottom-left');
          }
        }
        
        // Traverse only to computed reachable pins (tactile buttons preserve strength)
        for (const reachableType of reachablePinTypes) {
          const targetPin = component.pins.find(p => p.pinType === reachableType);
          if (!targetPin?.connectedNodeId) continue;
          const targetGroup = cache.get(targetPin.connectedNodeId) || [targetPin.connectedNodeId];
          for (const nodeId of targetGroup) {
            if (addNode(nodeId, currentStrength)) { // Tactile buttons preserve strength
              queue.push({ nodeId, strength: currentStrength });
            }
          }
        }
        continue; // Skip generic traversal for this component
      }
      
      // ---- PIN ROUTING RULES (v7.3) ----
      let targetNodeIds: string[] = [];
      const compDef = getDefinition(component.type);
      
      if (compDef.transistorType) {
        // Transistors: Current flows purely between Collector and Emitter in idealized model.
        // Base acts as a sensor and does not pass structural current.
        let targetType: string | null = null;
        if (pinType === 'collector') targetType = 'emitter';
        else if (pinType === 'emitter') targetType = 'collector';
        
        if (targetType) {
          const targetPin = component.pins.find(p => p.pinType === targetType);
          if (targetPin?.connectedNodeId) {
            targetNodeIds = cache.get(targetPin.connectedNodeId) || [targetPin.connectedNodeId];
          }
        }
      } else {
        // Default: all other connected pins
        targetNodeIds = otherPinNodeIds;
      }
      
      // Add all permitted nodes on the other side of the component
      for (const otherNodeId of targetNodeIds) {
        const otherGroup = cache.get(otherNodeId) || [otherNodeId];
        for (const nodeId of otherGroup) {
          if (addNode(nodeId, outputStrength)) {
            queue.push({ nodeId, strength: outputStrength });
          }
        }
      }
    }
  }
  
  return { strong: strongReachable, weak: weakReachable };
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
 * Find ALL active power sources and their terminal node IDs (trait-driven)
 * Supports multiple batteries: collects all positive/negative terminal nodes
 * into unified seed sets for the flood-fill algorithm.
 */
function findActivePowerSources(
  components: CircuitComponent[],
  cache: Map<string, string[]>
): {
  powerSources: CircuitComponent[];
  positiveNodes: Set<string>;
  negativeNodes: Set<string>;
} {
  // Find ALL active power sources (not just the first one)
  const powerSources = components.filter(c => isPowerSourceActive(c));

  if (powerSources.length === 0) {
    return { powerSources: [], positiveNodes: new Set(), negativeNodes: new Set() };
  }
  
  // Collect positive and negative terminal nodes from ALL power sources
  const positiveNodes = new Set<string>();
  const negativeNodes = new Set<string>();
  
  for (const source of powerSources) {
    const positivePin = source.pins.find(p => isPositiveEntryPin(p.pinType));
    const negativePin = source.pins.find(p => isNegativeEntryPin(p.pinType));
    
    if (positivePin?.connectedNodeId) {
      const group = cache.get(positivePin.connectedNodeId) || [positivePin.connectedNodeId];
      group.forEach(id => positiveNodes.add(id));
    }
    
    if (negativePin?.connectedNodeId) {
      const group = cache.get(negativePin.connectedNodeId) || [negativePin.connectedNodeId];
      group.forEach(id => negativeNodes.add(id));
    }
  }

  return { powerSources, positiveNodes, negativeNodes };
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
  
  // Find active power sources (trait-driven — supports multiple batteries)
  const { powerSources, positiveNodes: batteryPositive, negativeNodes: batteryNegative } = 
    findActivePowerSources(components, connectionCache);
  
  if (powerSources.length === 0) {
    result.message = 'No active power source found';
    return result;
  }
  
  // Use first power source ID for backward compatibility
  result.powerSourceId = powerSources[0].id;
  
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
      powerSourceId: powerSources[0].id,
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
  // 
  // STRONG vs WEAK CURRENT MODEL (v7.1):
  // We now track FOUR sets: strongPositive, weakPositive, strongNegative, weakNegative
  // Short circuits only occur when strongPositive ∩ strongNegative ≠ ∅
  // Pull-down/pull-up override: strong annihilates opposite-polarity weak
  // Component activation uses resolved (strong ∪ weak)Positive and (strong ∪ weak)Negative
  let strongPositiveNodes = new Set<string>();
  let strongNegativeNodes = new Set<string>();
  
  // Combined sets for backwards compatibility and activation checks
  let positiveReachable = new Set<string>();
  let negativeReachable = new Set<string>();
  
  // Transistor Dynamic State (Asynchronous Relaxation for zero-delay feedback loops)
  // Explictly tracks state to avoid synchronous symmetrical oscillations
  const transistorState = new Map<string, boolean>();
  for (const comp of components) {
    if (getDefinition(comp.type).transistorType) {
      // CRITICAL FOR MEMORY CIRCUITS (Flip-Flops/Latches):
      // Seed the relaxation solver with the transistor's LAST KNOWN STATE.
      const prevState = comp.state as Record<string, unknown>;
      transistorState.set(comp.id, prevState.isOn === true);
    }
  }
  
  const MAX_OUTER_PASSES = 15;
  const MAX_INNER_VPASSES = 5;
  
  for (let outerPass = 0; outerPass < MAX_OUTER_PASSES; outerPass++) {
    // --- INNER VOLTAGE LOOP ---
    // Settles the electrical voltage paths for the CURRENT transistorState.
    // This is required because 'oppositeStrongNodes' blocking needs 2-3 passes
    // to correctly block "phantom" weak positive voltage flowing downstream of
    // recently grounded nodes. Without this inner settling, transistors would
    // blindly flip state based on phantom voltage measurements.
    let setsChanged = false;
    
    for (let vPass = 0; vPass < MAX_INNER_VPASSES; vPass++) {
      const posResult = floodFill(
        initialPositiveSeeds,
        wireAdjacency,
        componentAdjacency,
        connectionCache,
        'forward',
        positiveReachable,
        negativeReachable,
        'strong',
        strongNegativeNodes,
        transistorState
      );
      
      const currentPositiveCombined = new Set([...posResult.strong, ...posResult.weak]);
      
      const negResult = floodFill(
        initialNegativeSeeds,
        wireAdjacency,
        componentAdjacency,
        connectionCache,
        'backward',
        currentPositiveCombined,
        negativeReachable,
        'strong',
        posResult.strong,
        transistorState
      );
      
      // === STRONG OVERRIDE RESOLUTION ===
      for (const node of negResult.strong) {
        posResult.weak.delete(node);
      }
      for (const node of posResult.strong) {
        negResult.weak.delete(node);
      }
      
      const stablePositiveCombined = new Set([...posResult.strong, ...posResult.weak]);
      const stableNegativeCombined = new Set([...negResult.strong, ...negResult.weak]);
      
      setsChanged = stablePositiveCombined.size !== positiveReachable.size ||
                    stableNegativeCombined.size !== negativeReachable.size;
      
      strongPositiveNodes = posResult.strong;
      strongNegativeNodes = negResult.strong;
      positiveReachable = stablePositiveCombined;
      negativeReachable = stableNegativeCombined;
      
      if (!setsChanged) break; // Voltages have perfectly settled for this pass
    }
    
    // --- OUTER LOOP: ASYNCHRONOUS RELAXATION CHECK ---
    // Now that we have TRUE steady-state voltage paths, determine which transistors
    // should switch state.
    let transistorChanged = false;
    for (const comp of components) {
      const def = getDefinition(comp.type);
      if (def.transistorType) {
        const basePin = comp.pins.find(p => p.pinType === 'base');
        if (!basePin?.connectedNodeId) continue;
        
        const baseGroup = connectionCache.get(basePin.connectedNodeId) || [basePin.connectedNodeId];
        let shouldBeOn = false;
        
        if (def.transistorType === 'npn') {
          shouldBeOn = baseGroup.some(n => positiveReachable.has(n));
        } else {
          shouldBeOn = baseGroup.some(n => negativeReachable.has(n));
        }
        
        if (transistorState.get(comp.id) !== shouldBeOn) {
          transistorState.set(comp.id, shouldBeOn);
          transistorChanged = true;
          // CRITICAL: Only allow ONE transistor to change state per outer pass!
          // This breaks mathematical symmetry in idealized bistable circuits.
          break; 
        }
      }
    }
    
    // If NO transistors wanted to change state this pass, the entire circuit is fully stable!
    if (!transistorChanged) {
      break; 
    }
  }
  
  // === POST-FLOOD-FILL SHORT CIRCUIT DETECTION (v7.0: Strong-Only Check) ===
  // CRITICAL FIX: Only check intersection of STRONG sets!
  // A resistive bridge (Battery+ → Resistor → Switch → Battery-) creates weak current,
  // NOT a short circuit. Only STRONG-to-STRONG paths without resistance are dead shorts.
  //
  // Old (buggy): positiveReachable ∩ negativeReachable → false positive on resistive bridges
  // New (fixed): strongPositiveNodes ∩ strongNegativeNodes → only true dead shorts
  {
    let hasIntersection = false;
    const intersectionPath: string[] = [];
    
    // ONLY check intersection of STRONG sets
    for (const node of strongPositiveNodes) {
      if (strongNegativeNodes.has(node)) {
        hasIntersection = true;
        intersectionPath.push(node);
        break; // One overlap is sufficient to confirm short
      }
    }
    
    if (hasIntersection) {
      // Simulate tripped breaker: clear all voltage potential
      return {
        status: 'short-circuit',
        isCircuitComplete: false,
        activePath: intersectionPath,
        powerSourceId: powerSources[0].id,
        componentStates: result.componentStates,
        shortCircuitPath: intersectionPath,
        message: 'SHORT CIRCUIT! Strong positive and negative paths have merged without resistance',
        positiveReachable: new Set<string>(),
        negativeReachable: new Set<string>(),
      };
    }
  }
  
  // Note: Strong Override Resolution has been moved inside the stabilization loop
  // in v7.2 to ensure overrides correctly settle Transistor context paths.
  
  // === STEP 4: EVALUATE EACH COMPONENT (Trait-Driven) ===
  // COMPONENT ACTIVATION (v7.1): Uses resolved (strong ∪ weak) reachable sets.
  // Components activate if ANY current (strong OR weak) reaches both their pins.
  // AFTER strong override: weak nodes pulled to opposite polarity are excluded.
  // This allows LEDs to light up through resistors, but turn OFF when bypassed.
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
    if (def.isConductive && !componentConducts(component, connectionCache, positiveReachable, negativeReachable, transistorState)) continue;
    
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
  
  // === SAVE EVALUATED TRANSISTOR STATES TO PERSIST MEMORY ACROSS FRAMES ===
  for (const [compId, isOn] of transistorState.entries()) {
    const component = components.find(c => c.id === compId);
    if (component) {
      const currentState = result.componentStates.get(compId) || { ...component.state as Record<string, unknown> };
      const newState = { ...currentState, isOn };
      result.componentStates.set(compId, newState as ComponentState);
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
      powerSourceId: powerSources[0].id,
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
