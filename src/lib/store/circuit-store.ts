import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import {
  BreadboardNode,
  CircuitComponent,
  Wire,
  ToolType,
  SimulationResult,
  ComponentType,
  ComponentPin,
  LEDState,
  BatteryState,
  SwitchState,
  ResistorState,
  CapacitorState,
  BuzzerState,
} from '../types';
import { createBreadboardNodes } from '../engine/breadboard-factory';
import { evaluateCircuit, getActiveNodes } from '../engine/circuit-evaluator';
import { COLORS, STORAGE_KEYS, COMPONENT_DEFINITIONS } from '../constants';

interface SerializedWire {
  id: string;
  startNodeId: string;
  endNodeId: string;
  color: string;
}

interface SerializedComponent {
  id: string;
  type: ComponentType;
  pinNodeIds: (string | null)[];
  state: Record<string, unknown>;
}

interface SerializedState {
  wires: SerializedWire[];
  components: SerializedComponent[];
  version: number;
}

const MAX_STORAGE_SIZE = 500 * 1024;

function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__vbl_storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function safeStringify(data: unknown): string | null {
  try {
    const str = JSON.stringify(data);
    if (str.length > MAX_STORAGE_SIZE) {
      console.warn('[VBL] Storage payload exceeds limit, clearing storage');
      return null;
    }
    return str;
  } catch (e) {
    console.error('[VBL] Failed to serialize state:', e);
    return null;
  }
}

function safeParse<T>(str: string | null): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch (e) {
    console.error('[VBL] Failed to parse stored state, clearing:', e);
    return null;
  }
}

const safeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (!isLocalStorageAvailable()) return null;
    try {
      const value = localStorage.getItem(name);
      // Validate it parses correctly
      if (value && safeParse(value) === null) {
        localStorage.removeItem(name);
        return null;
      }
      return value;
    } catch (e) {
      console.error('[VBL] localStorage read error:', e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (!isLocalStorageAvailable()) return;
    try {
      const safe = safeStringify(safeParse(value));
      if (safe) {
        localStorage.setItem(name, safe);
      } else {
        // Clear if we can't safely store
        localStorage.removeItem(name);
      }
    } catch (e) {
      console.error('[VBL] localStorage write error:', e);
      try {
        localStorage.removeItem(name);
      } catch {
        // Ignore cleanup errors
      }
    }
  },
  removeItem: (name: string): void => {
    if (!isLocalStorageAvailable()) return;
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.error('[VBL] localStorage remove error:', e);
    }
  },
};

// ---- SERIALIZATION HELPERS ----
function serializeComponent(component: CircuitComponent): SerializedComponent {
  return {
    id: component.id,
    type: component.type,
    pinNodeIds: component.pins.map(p => p.connectedNodeId),
    state: component.state as Record<string, unknown>,
  };
}

function deserializeComponent(
  serialized: SerializedComponent,
  nodes: Map<string, BreadboardNode>
): CircuitComponent | null {
  const definition = COMPONENT_DEFINITIONS[serialized.type];
  if (!definition) return null;

  // Reconstruct pins
  const pins: ComponentPin[] = definition.pinTypes.map((pinType, index) => ({
    id: `${serialized.id}-${pinType}`,
    pinType,
    connectedNodeId: serialized.pinNodeIds[index] ?? null,
  }));

  // Calculate canvas position from connected nodes
  const connectedNodes = serialized.pinNodeIds
    .filter((id): id is string => id !== null)
    .map(id => nodes.get(id))
    .filter((n): n is BreadboardNode => n !== undefined);

  if (connectedNodes.length === 0) return null;

  const canvasPosition = {
    x: connectedNodes.reduce((sum, n) => sum + n.canvasPosition.x, 0) / connectedNodes.length,
    y: connectedNodes.reduce((sum, n) => sum + n.canvasPosition.y, 0) / connectedNodes.length,
  };

  return {
    id: serialized.id,
    type: serialized.type,
    pins,
    canvasPosition,
    rotation: 0,
    state: serialized.state,
  };
}

// ---- Store State Interface ----
interface CircuitStoreState {
  // Breadboard structure
  nodes: Map<string, BreadboardNode>;
  
  // Placed components
  components: CircuitComponent[];
  
  // Wires
  wires: Wire[];
  selectedColor: string;
  
  // UI State
  selectedTool: ToolType;
  selectedComponentId: string | null;
  wireStartNodeId: string | null;
  hoveredNodeId: string | null;
  
  // Simulation results
  simulation: SimulationResult;
  activeNodes: Set<string>;
  positiveNodes: Set<string>; // Nodes with positive voltage potential
  negativeNodes: Set<string>; // Nodes with negative voltage potential
  
  // Component placement mode
  placementComponent: ComponentType | null;
  placementPins: string[]; // Node IDs for each pin during placement
}

// ---- Store Actions Interface ----
interface CircuitStoreActions {
  // Tool actions
  setSelectedTool: (tool: ToolType) => void;
  
  // Node interaction
  setHoveredNode: (nodeId: string | null) => void;
  handleNodeClick: (nodeId: string) => void;
  
  // Wire actions
  startWire: (nodeId: string) => void;
  endWire: (nodeId: string) => void;
  cancelWire: () => void;
  setSelectedColor: (color: string) => void;
  removeWire: (wireId: string) => void;
  
  // Component actions
  startComponentPlacement: (type: ComponentType) => void;
  placeComponentPin: (nodeId: string) => void;
  cancelComponentPlacement: () => void;
  removeComponent: (componentId: string) => void;
  selectComponent: (componentId: string | null) => void;
  toggleSwitch: (componentId: string) => void;
  
  // Simulation
  runSimulation: () => void;
  
  // General
  clearAll: () => void;
  loadCircuit: (components: CircuitComponent[], wires: Wire[]) => void;
  
  // Initialize
  initialize: () => void;
}

type CircuitStore = CircuitStoreState & CircuitStoreActions;

// ---- Helper Functions ----
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createComponentPins(type: ComponentType, componentId: string): ComponentPin[] {
  const definition = COMPONENT_DEFINITIONS[type];
  if (!definition) return [];
  
  return definition.pinTypes.map((pinType) => ({
    id: `${componentId}-${pinType}`,
    pinType,
    connectedNodeId: null,
  }));
}

function getDefaultComponentState(type: ComponentType): BatteryState | LEDState | SwitchState | ResistorState | CapacitorState | BuzzerState | Record<string, unknown> {
  switch (type) {
    case 'battery':
      return { voltage: 5, isOn: true } as BatteryState;
    case 'led':
      return { isLit: false, color: '#22C55E' } as LEDState;
    case 'switch':
      return { isClosed: false } as SwitchState;
    case 'resistor':
      return { resistance: 220 } as ResistorState;
    case 'capacitor':
      return { capacitance: 10 } as CapacitorState;
    case 'buzzer':
      return { isActive: false, frequency: 2000 } as BuzzerState;
    default:
      return {};
  }
}

// ---- Initial State ----
const initialNodes = createBreadboardNodes();

const initialState: CircuitStoreState = {
  nodes: initialNodes,
  components: [],
  wires: [],
  selectedColor: COLORS.PALETTE_RED,
  selectedTool: 'select',
  selectedComponentId: null,
  wireStartNodeId: null,
  hoveredNodeId: null,
  simulation: {
    status: 'incomplete',
    isCircuitComplete: false,
    activePath: [],
    powerSourceId: null,
    componentStates: new Map(),
    message: 'No circuit',
    positiveReachable: new Set(),
    negativeReachable: new Set(),
  },
  activeNodes: new Set(),
  positiveNodes: new Set(),
  negativeNodes: new Set(),
  placementComponent: null,
  placementPins: [],
};

// ---- Create Store ----
export const useCircuitStore = create<CircuitStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // ---- Tool Actions ----
      setSelectedTool: (tool) => {
        set({
          selectedTool: tool,
          wireStartNodeId: null,
          placementComponent: null,
          placementPins: [],
        });
        
        // If selecting a component type, start placement mode
        if (['battery', 'led', 'resistor', 'switch', 'capacitor', 'buzzer'].includes(tool)) {
          get().startComponentPlacement(tool as ComponentType);
        }
      },
      
      // ---- Node Interaction ----
      setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
      
      handleNodeClick: (nodeId) => {
        const state = get();
        const node = state.nodes.get(nodeId);
        
        if (!node) return;
        
        switch (state.selectedTool) {
          case 'wire':
            if (state.wireStartNodeId === null) {
              state.startWire(nodeId);
            } else {
              state.endWire(nodeId);
            }
            break;
            
          case 'delete':
            // Find and delete wire or component at this node
            const wireToDelete = state.wires.find(
              (w) => w.startNodeId === nodeId || w.endNodeId === nodeId
            );
            if (wireToDelete) {
              state.removeWire(wireToDelete.id);
            }
            
            const componentToDelete = state.components.find((c) =>
              c.pins.some((p) => p.connectedNodeId === nodeId)
            );
            if (componentToDelete) {
              state.removeComponent(componentToDelete.id);
            }
            break;
            
          case 'battery':
          case 'led':
          case 'resistor':
          case 'switch':
          case 'capacitor':
          case 'buzzer':
            state.placeComponentPin(nodeId);
            break;
            
          case 'select':
          default:
            // Select component at this node
            const component = state.components.find((c) =>
              c.pins.some((p) => p.connectedNodeId === nodeId)
            );
            state.selectComponent(component?.id ?? null);
            break;
        }
      },
      
      // ---- Wire Actions ----
      startWire: (nodeId) => {
        set({ wireStartNodeId: nodeId });
        // Sync with isolated wire drawing state for preview rendering
        startWireDrawing(nodeId);
      },
      
      endWire: (nodeId) => {
        const state = get();
        const startNodeId = state.wireStartNodeId;
        
        // Always stop wire drawing preview
        stopWireDrawing();
        
        if (!startNodeId || startNodeId === nodeId) {
          set({ wireStartNodeId: null });
          return;
        }
        
        // Check if wire already exists
        const wireExists = state.wires.some(
          (w) =>
            (w.startNodeId === startNodeId && w.endNodeId === nodeId) ||
            (w.startNodeId === nodeId && w.endNodeId === startNodeId)
        );
        
        if (wireExists) {
          set({ wireStartNodeId: null });
          return;
        }
        
        // Create new wire
        const newWire: Wire = {
          id: generateId(),
          startNodeId,
          endNodeId: nodeId,
          color: state.selectedColor,
        };
        
        set({
          wires: [...state.wires, newWire],
          wireStartNodeId: null,
        });
        
        // Run simulation ONLY after wire is finalized (not during drag)
        get().runSimulation();
      },
      
      cancelWire: () => {
        set({ wireStartNodeId: null });
        stopWireDrawing();
      },
      
      setSelectedColor: (color) => set({ selectedColor: color }),
      
      removeWire: (wireId) => {
        set((state) => ({
          wires: state.wires.filter((w) => w.id !== wireId),
        }));
        get().runSimulation();
      },
      
      // ---- Component Actions ----
      startComponentPlacement: (type) => {
        set({
          placementComponent: type,
          placementPins: [],
        });
      },
      
      placeComponentPin: (nodeId) => {
        const state = get();
        const node = state.nodes.get(nodeId);
        
        if (!node || !state.placementComponent) return;
        
        // Check if node is occupied
        if (node.isOccupied) return;
        
        const definition = COMPONENT_DEFINITIONS[state.placementComponent];
        if (!definition) return;
        
        const newPins = [...state.placementPins, nodeId];
        
        // Check if we have all pins placed
        if (newPins.length >= definition.pinCount) {
          // Create the component
          const componentId = generateId();
          const pins = createComponentPins(state.placementComponent, componentId);
          
          // Connect pins to nodes
          pins.forEach((pin, index) => {
            pin.connectedNodeId = newPins[index];
          });
          
          // Calculate canvas position (center of the component)
          const firstNode = state.nodes.get(newPins[0])!;
          const lastNode = state.nodes.get(newPins[newPins.length - 1])!;
          const canvasPosition = {
            x: (firstNode.canvasPosition.x + lastNode.canvasPosition.x) / 2,
            y: (firstNode.canvasPosition.y + lastNode.canvasPosition.y) / 2,
          };
          
          // Get default component state, inject selectedColor for LED
          let componentState = getDefaultComponentState(state.placementComponent);
          if (state.placementComponent === 'led') {
            componentState = { ...componentState, color: state.selectedColor } as LEDState;
          }
          
          const newComponent: CircuitComponent = {
            id: componentId,
            type: state.placementComponent,
            pins,
            canvasPosition,
            rotation: 0,
            state: componentState,
          };
          
          // Mark nodes as occupied
          const updatedNodes = new Map(state.nodes);
          newPins.forEach((pinNodeId) => {
            const n = updatedNodes.get(pinNodeId);
            if (n) {
              updatedNodes.set(pinNodeId, {
                ...n,
                isOccupied: true,
                occupiedBy: componentId,
              });
            }
          });
          
          set({
            components: [...state.components, newComponent],
            nodes: updatedNodes,
            placementComponent: null,
            placementPins: [],
            selectedTool: 'select',
          });
          
          // Run simulation after placing component
          get().runSimulation();
        } else {
          // Wait for more pins
          set({ placementPins: newPins });
        }
      },
      
      cancelComponentPlacement: () => {
        set({
          placementComponent: null,
          placementPins: [],
          selectedTool: 'select',
        });
      },
      
      removeComponent: (componentId) => {
        const state = get();
        const component = state.components.find((c) => c.id === componentId);
        
        if (!component) return;
        
        // Free up nodes
        const updatedNodes = new Map(state.nodes);
        component.pins.forEach((pin) => {
          if (pin.connectedNodeId) {
            const node = updatedNodes.get(pin.connectedNodeId);
            if (node) {
              updatedNodes.set(pin.connectedNodeId, {
                ...node,
                isOccupied: false,
                occupiedBy: undefined,
              });
            }
          }
        });
        
        set({
          components: state.components.filter((c) => c.id !== componentId),
          nodes: updatedNodes,
          selectedComponentId:
            state.selectedComponentId === componentId ? null : state.selectedComponentId,
        });
        
        get().runSimulation();
      },
      
      selectComponent: (componentId) => {
        set({ selectedComponentId: componentId });
      },
      
      toggleSwitch: (componentId) => {
        const state = get();
        const component = state.components.find((c) => c.id === componentId);
        
        if (!component || component.type !== 'switch') return;
        
        const currentState = component.state as SwitchState;
        const newComponents = state.components.map((c) => {
          if (c.id === componentId) {
            return {
              ...c,
              state: { ...currentState, isClosed: !currentState.isClosed },
            };
          }
          return c;
        });
        
        set({ components: newComponents });
        get().runSimulation();
      },
      
      // ---- Simulation ----
      runSimulation: () => {
        const state = get();
        const result = evaluateCircuit(state.nodes, state.components, state.wires);
        const newActiveNodes = getActiveNodes(result.activePath, state.nodes);
        
        // CRITICAL: Avoid creating new Set reference if contents are identical
        // This prevents cascading re-renders when Sets haven't actually changed
        
        // Helper function to compare sets
        const areSetsEqual = (setA: Set<string>, setB: Set<string>): boolean => {
          if (setA.size !== setB.size) return false;
          for (const item of setA) {
            if (!setB.has(item)) return false;
          }
          return true;
        };
        
        // Compare activeNodes
        const activeNodesToSet = areSetsEqual(state.activeNodes, newActiveNodes)
          ? state.activeNodes
          : newActiveNodes;
        
        // Compare positiveNodes
        const positiveNodesToSet = areSetsEqual(state.positiveNodes, result.positiveReachable)
          ? state.positiveNodes
          : result.positiveReachable;
        
        // Compare negativeNodes
        const negativeNodesToSet = areSetsEqual(state.negativeNodes, result.negativeReachable)
          ? state.negativeNodes
          : result.negativeReachable;
        
        set({
          simulation: result,
          activeNodes: activeNodesToSet,
          positiveNodes: positiveNodesToSet,
          negativeNodes: negativeNodesToSet,
        });
      },
      
      // ---- General ----
      clearAll: () => {
        const freshNodes = createBreadboardNodes();
        set({
          ...initialState,
          nodes: freshNodes,
        });
      },
      
      loadCircuit: (components, wires) => {
        const freshNodes = createBreadboardNodes();
        
        // Mark occupied nodes
        components.forEach((component) => {
          component.pins.forEach((pin) => {
            if (pin.connectedNodeId) {
              const node = freshNodes.get(pin.connectedNodeId);
              if (node) {
                freshNodes.set(pin.connectedNodeId, {
                  ...node,
                  isOccupied: true,
                  occupiedBy: component.id,
                });
              }
            }
          });
        });
        
        set({
          nodes: freshNodes,
          components,
          wires,
        });
        
        get().runSimulation();
      },
      
      initialize: () => {
        // CRITICAL: Only create fresh nodes if store is empty (no hydrated data)
        // This prevents overwriting hydrated state on returning users
        const currentState = get();
        if (currentState.nodes.size === 0) {
          set({ nodes: createBreadboardNodes() });
        }
        // Note: If nodes exist (from hydration), do nothing - hydration is the source of truth
      },
    }),
    {
      name: STORAGE_KEYS.CURRENT_CIRCUIT,
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      // MINIMAL SERIALIZATION: Only save essential node IDs and state
      partialize: (state): SerializedState => ({
        version: 1,
        wires: state.wires.map(w => ({
          id: w.id,
          startNodeId: w.startNodeId,
          endNodeId: w.endNodeId,
          color: w.color,
        })),
        components: state.components.map(serializeComponent),
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          return persistedState as unknown as CircuitStore;
        }
        return persistedState as unknown as CircuitStore;
      },
      merge: (persisted, current) => {
        const serialized = persisted as SerializedState | null;
        
        if (!serialized || !serialized.version) {
          // No valid stored state, starting fresh
          return current;
        }

        try {
          // Reconstruct nodes fresh
          const freshNodes = createBreadboardNodes();

          // Deserialize components
          const components: CircuitComponent[] = [];
          for (const sc of serialized.components || []) {
            const component = deserializeComponent(sc, freshNodes);
            if (component) {
              components.push(component);
              // Mark nodes as occupied
              component.pins.forEach(pin => {
                if (pin.connectedNodeId) {
                  const node = freshNodes.get(pin.connectedNodeId);
                  if (node) {
                    freshNodes.set(pin.connectedNodeId, {
                      ...node,
                      isOccupied: true,
                      occupiedBy: component.id,
                    });
                  }
                }
              });
            }
          }

          // Validate wires (ensure both nodes exist)
          const wires: Wire[] = (serialized.wires || []).filter(w => 
            freshNodes.has(w.startNodeId) && freshNodes.has(w.endNodeId)
          );

          return {
            ...current,
            nodes: freshNodes,
            components,
            wires,
          };
        } catch (e) {
          console.error('[VBL] Failed to rehydrate state, starting fresh:', e);
          // Clear corrupted storage
          if (isLocalStorageAvailable()) {
            try {
              localStorage.removeItem(STORAGE_KEYS.CURRENT_CIRCUIT);
            } catch {
              // Ignore cleanup errors
            }
          }
          return current;
        }
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[VBL] Rehydration error:', error);
          // Clear corrupted storage
          if (isLocalStorageAvailable()) {
            try {
              localStorage.removeItem(STORAGE_KEYS.CURRENT_CIRCUIT);
            } catch {
              // Ignore
            }
          }
          return;
        }
        if (state) {
          // Defer simulation to avoid blocking initial render
          setTimeout(() => {
            state.runSimulation();
          }, 0);
        }
      },
    }
  )
);

// ---- Force Clear Storage (Emergency Recovery) ----
export function clearVBLStorage(): void {
  if (!isLocalStorageAvailable()) {
    console.warn('[VBL] localStorage not available');
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_CIRCUIT);
    localStorage.removeItem(STORAGE_KEYS.SAVED_CIRCUITS);
    localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    // Storage cleared successfully
  } catch (e) {
    console.error('[VBL] Failed to clear storage:', e);
  }
}

// ---- Selector Hooks (Optimized with shallow comparison) ----
export const useNodes = () => useCircuitStore((state) => state.nodes);
export const useComponents = () => useCircuitStore((state) => state.components);
export const useWires = () => useCircuitStore((state) => state.wires);
export const useSelectedTool = () => useCircuitStore((state) => state.selectedTool);
export const useSimulation = () => useCircuitStore((state) => state.simulation);
export const useActiveNodes = () => useCircuitStore((state) => state.activeNodes);
export const usePositiveNodes = () => useCircuitStore((state) => state.positiveNodes);
export const useNegativeNodes = () => useCircuitStore((state) => state.negativeNodes);

// ---- Isolated Wire Drawing State (Does NOT trigger component re-renders) ----
// This is a lightweight ref-based store for temporary wire drawing visuals
// CRITICAL: This state is completely separate from Zustand to prevent render cascades
interface WireDrawingState {
  isDrawing: boolean;
  startNodeId: string | null;
  currentX: number;
  currentY: number;
}

let wireDrawingState: WireDrawingState = {
  isDrawing: false,
  startNodeId: null,
  currentX: 0,
  currentY: 0,
};

const wireDrawingListeners = new Set<() => void>();
let isNotifying = false; // Guard against re-entrant notifications

export function getWireDrawingState(): WireDrawingState {
  return wireDrawingState;
}

export function setWireDrawingPosition(x: number, y: number): void {
  // Only update if actually drawing and position changed
  if (!wireDrawingState.isDrawing) return;
  if (wireDrawingState.currentX === x && wireDrawingState.currentY === y) return;
  
  wireDrawingState = { ...wireDrawingState, currentX: x, currentY: y };
  notifyListeners();
}

export function startWireDrawing(startNodeId: string): void {
  wireDrawingState = { isDrawing: true, startNodeId, currentX: 0, currentY: 0 };
  notifyListeners();
}

export function stopWireDrawing(): void {
  wireDrawingState = { isDrawing: false, startNodeId: null, currentX: 0, currentY: 0 };
  notifyListeners();
}

function notifyListeners(): void {
  // Guard against re-entrant calls
  if (isNotifying) return;
  isNotifying = true;
  try {
    wireDrawingListeners.forEach(fn => fn());
  } finally {
    isNotifying = false;
  }
}

export function subscribeToWireDrawing(listener: () => void): () => void {
  wireDrawingListeners.add(listener);
  return () => wireDrawingListeners.delete(listener);
}
