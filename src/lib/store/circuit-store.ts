import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
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
import { globalSoundSystem } from '@/hooks/useUISounds';

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
  selectedWireId: string | null; // NEW: Selected wire (mutually exclusive with selectedComponentId)
  wireStartNodeId: string | null;
  
  // Simulation results
  simulation: SimulationResult;
  activeNodes: Set<string>;
  positiveNodes: Set<string>; // Nodes with positive voltage potential
  negativeNodes: Set<string>; // Nodes with negative voltage potential
  
  // Component placement mode
  placementComponent: ComponentType | null;
  placementPins: string[]; // Node IDs for each pin during placement
  
  // Animation state (for pop-in effect)
  recentlyPlacedIds: Set<string>; // Component IDs placed in last 300ms
  
  // Onboarding tour state
  isTourRunning: boolean;
  
  // History for Undo/Redo
  history: {
    past: { components: CircuitComponent[]; wires: Wire[] }[];
    future: { components: CircuitComponent[]; wires: Wire[] }[];
  };
}

// ---- Store Actions Interface ----
interface CircuitStoreActions {
  // Tool actions
  setSelectedTool: (tool: ToolType) => void;
  
  // Node interaction
  handleNodeClick: (nodeId: string) => void;
  
  // Wire actions
  startWire: (nodeId: string) => void;
  endWire: (nodeId: string) => void;
  cancelWire: () => void;
  setSelectedColor: (color: string) => void;
  removeWire: (wireId: string) => void;
  selectWire: (wireId: string | null) => void; // NEW: Select a wire
  
  // Component actions
  startComponentPlacement: (type: ComponentType) => void;
  placeComponentPin: (nodeId: string) => void;
  cancelComponentPlacement: () => void;
  removeComponent: (componentId: string) => void;
  selectComponent: (componentId: string | null) => void;
  toggleSwitch: (componentId: string) => void;
  setButtonPressed: (componentId: string, pressed: boolean) => void;
  
  // Generic delete action
  deleteSelected: () => void; // NEW: Delete currently selected component or wire
  
  // Simulation
  runSimulation: () => void;
  tick: () => void;
  
  // General
  clearAll: () => void;
  loadCircuit: (components: CircuitComponent[], wires: Wire[], isHistory?: boolean) => void;
  
  // Export / Import
  exportCircuit: () => void;
  importCircuit: (jsonString: string) => void;
  
  // Clipboard Actions
  copyCircuitToClipboard: () => Promise<boolean>;
  pasteCircuitFromClipboard: () => Promise<boolean>;
  
  // History Actions
  undo: () => void;
  redo: () => void;
  saveSnapshot: () => void;
  
  // Onboarding Tour Actions
  startTour: () => void;
  stopTour: () => void;
  
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

/**
 * TRAIT-DRIVEN: Get default state from COMPONENT_DEFINITIONS
 * This ensures consistency and allows new components to work automatically.
 */
function getDefaultComponentState(type: ComponentType): BatteryState | LEDState | SwitchState | ResistorState | CapacitorState | BuzzerState | Record<string, unknown> {
  const definition = COMPONENT_DEFINITIONS[type];
  if (definition?.defaultState) {
    // Return a copy to prevent mutation of the definition
    return { ...definition.defaultState };
  }
  return {};
}

/**
 * Mark a component as recently placed for animation purposes.
 * Automatically removes it from the set after 300ms.
 */
function markAsRecentlyPlaced(componentId: string, recentlyPlacedIds: Set<string>, setState: (fn: (state: CircuitStoreState) => Partial<CircuitStoreState>) => void): void {
  const newSet = new Set(recentlyPlacedIds);
  newSet.add(componentId);
  setState(() => ({ recentlyPlacedIds: newSet }));
  
  // Auto-expire after 300ms
  setTimeout(() => {
    setState((state) => {
      const updatedSet = new Set(state.recentlyPlacedIds);
      updatedSet.delete(componentId);
      return { recentlyPlacedIds: updatedSet };
    });
  }, 300);
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
  selectedWireId: null, // NEW: No wire selected initially
  wireStartNodeId: null,
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
  recentlyPlacedIds: new Set(),
  isTourRunning: false,
  history: { past: [], future: [] },
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
        // Trait-driven: check COMPONENT_DEFINITIONS instead of hardcoding types
        if (tool in COMPONENT_DEFINITIONS) {
          get().startComponentPlacement(tool as ComponentType);
        }
      },
      
      // ---- Node Interaction ----
      handleNodeClick: (nodeId) => {
        const state = get();
        const node = state.nodes.get(nodeId);
        
        if (!node) return;
        
        // TRAIT-DRIVEN: Check if selectedTool is a component type from COMPONENT_DEFINITIONS
        // This eliminates the need for hardcoded type lists
        const isComponentTool = state.selectedTool in COMPONENT_DEFINITIONS;
        
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
            
          case 'select':
            // Select component at this node
            const component = state.components.find((c) =>
              c.pins.some((p) => p.connectedNodeId === nodeId)
            );
            state.selectComponent(component?.id ?? null);
            break;
            
          default:
            // TRAIT-DRIVEN: Any component type from COMPONENT_DEFINITIONS triggers placement
            if (isComponentTool) {
              state.placeComponentPin(nodeId);
            } else {
              // Unknown tool - fallback to select behavior
              const fallbackComponent = state.components.find((c) =>
                c.pins.some((p) => p.connectedNodeId === nodeId)
              );
              state.selectComponent(fallbackComponent?.id ?? null);
            }
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
        
        get().saveSnapshot();
        
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
        
        // Sound feedback
        globalSoundSystem.playClick();
        
        // Run simulation ONLY after wire is finalized (not during drag)
        get().runSimulation();
      },
      
      cancelWire: () => {
        set({ wireStartNodeId: null });
        stopWireDrawing();
      },
      
      setSelectedColor: (color) => set({ selectedColor: color }),
      
      removeWire: (wireId) => {
        get().saveSnapshot();
        set((state) => ({
          wires: state.wires.filter((w) => w.id !== wireId),
          // Clear selection if this wire was selected
          selectedWireId: state.selectedWireId === wireId ? null : state.selectedWireId,
        }));
        // Sound feedback
        globalSoundSystem.playDelete();
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
        
        // ---- 3-PIN AUTO-PLACEMENT (Transistors) ----
        // For 3-pin components, a single click auto-resolves all 3 pins
        // using consecutive columns in the same row (col, col+1, col+2)
        if (definition.pinCount === 3) {
          const rootRow = node.id.split('-')[0]; // e.g. "A" from "A-5"
          const rootCol = node.position.col;
          
          // Find 3 consecutive nodes: rootCol, rootCol+1, rootCol+2
          const pinNodeIds: string[] = [];
          for (let offset = 0; offset < 3; offset++) {
            const targetCol = rootCol + offset;
            const targetId = `${rootRow}-${targetCol}`;
            const targetNode = state.nodes.get(targetId);
            
            if (!targetNode) {
              // Node doesn't exist (edge of board)
              return;
            }
            if (targetNode.isOccupied) {
              // One of the required nodes is occupied
              return;
            }
            pinNodeIds.push(targetId);
          }
          
          // All 3 nodes validated — place the component
          get().saveSnapshot();
          const componentId = generateId();
          const pins = createComponentPins(state.placementComponent, componentId);
          
          pins.forEach((pin, index) => {
            pin.connectedNodeId = pinNodeIds[index];
          });
          
          const firstNode = state.nodes.get(pinNodeIds[0])!;
          const lastNode = state.nodes.get(pinNodeIds[2])!;
          const canvasPosition = {
            x: (firstNode.canvasPosition.x + lastNode.canvasPosition.x) / 2,
            y: (firstNode.canvasPosition.y + lastNode.canvasPosition.y) / 2,
          };
          
          const componentState = getDefaultComponentState(state.placementComponent);
          
          const newComponent: CircuitComponent = {
            id: componentId,
            type: state.placementComponent,
            pins,
            canvasPosition,
            rotation: 0,
            state: componentState,
          };
          
          const updatedNodes = new Map(state.nodes);
          pinNodeIds.forEach((pinNodeId) => {
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
          
          // Sound feedback + animation
          globalSoundSystem.playSnap();
          markAsRecentlyPlaced(componentId, state.recentlyPlacedIds, set);
          
          get().runSimulation();
          return;
        }
        
        // ---- 4-PIN TRENCH-STRADDLING PLACEMENT (Tactile Button) ----
        // 4-pin components straddle the center trench (Row E ↔ Row F).
        // Pin layout: 2 columns × 2 rows
        //   tb-top-left  (clickedRow, col)    |  tb-top-right  (clickedRow, col+1)
        //   tb-bottom-left (oppositeRow, col) |  tb-bottom-right (oppositeRow, col+1)
        if (definition.pinCount === 4) {
          const parts = node.id.split('-');
          const rootRow = parts[0];
          const rootCol = parseInt(parts[1], 10);
          
          // Enforce placement only on trench-edge rows (E or F)
          const TRENCH_MAP: Record<string, string> = { 'E': 'F', 'F': 'E' };
          const oppositeRow = TRENCH_MAP[rootRow];
          if (!oppositeRow) {
            alert('Tactile button must be placed on Row E or Row F to straddle the center trench.');
            return;
          }
          
          // Pin node mapping: [top-left, bottom-left, top-right, bottom-right]
          const pinNodeIds: string[] = [];
          const targetIds = [
            `${rootRow}-${rootCol}`,        // tb-top-left
            `${oppositeRow}-${rootCol}`,     // tb-bottom-left
            `${rootRow}-${rootCol + 1}`,     // tb-top-right
            `${oppositeRow}-${rootCol + 1}`, // tb-bottom-right
          ];
          
          for (const targetId of targetIds) {
            const targetNode = state.nodes.get(targetId);
            if (!targetNode || targetNode.isOccupied) {
              console.warn(`[VBL] Tactile button placement blocked: node ${targetId} ${!targetNode ? 'does not exist' : 'is occupied'}`);
              return;
            }
            pinNodeIds.push(targetId);
          }
          
          // All 4 nodes validated — place the component
          get().saveSnapshot();
          const componentId = generateId();
          const pins = createComponentPins(state.placementComponent, componentId);
          
          pins.forEach((pin, index) => {
            pin.connectedNodeId = pinNodeIds[index];
          });
          
          // Canvas position: center of the 4-pin footprint
          const topLeft = state.nodes.get(pinNodeIds[0])!;
          const bottomRight = state.nodes.get(pinNodeIds[3])!;
          const canvasPosition = {
            x: (topLeft.canvasPosition.x + bottomRight.canvasPosition.x) / 2,
            y: (topLeft.canvasPosition.y + bottomRight.canvasPosition.y) / 2,
          };
          
          const componentState = getDefaultComponentState(state.placementComponent);
          
          const newComponent: CircuitComponent = {
            id: componentId,
            type: state.placementComponent,
            pins,
            canvasPosition,
            rotation: 0,
            state: componentState,
          };
          
          const updatedNodes = new Map(state.nodes);
          pinNodeIds.forEach((pinNodeId) => {
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
          
          // Sound feedback + animation
          globalSoundSystem.playSnap();
          markAsRecentlyPlaced(componentId, state.recentlyPlacedIds, set);
          
          get().runSimulation();
          return;
        }
        
        // ---- DIP-8 AUTO-PLACEMENT (ICs like 555 Timer) ----
        // DIP-8 must straddle the center trench (Row E ↔ Row F).
        // Pins 1-4 on the clicked row, Pins 5-8 on the opposite row (reversed, standard U-shape).
        if (definition.pinCount === 8) {
          const parts = node.id.split('-');
          const rootRow = parts[0]; // e.g. "E" from "E-10"
          const rootCol = parseInt(parts[1], 10);
          
          // Enforce placement only on trench-edge rows (E or F)
          const TRENCH_MAP: Record<string, string> = { 'E': 'F', 'F': 'E' };
          const oppositeRow = TRENCH_MAP[rootRow];
          if (!oppositeRow) {
            // User clicked a non-trench row — tell them why
            alert('IC must be placed on Row E or Row F to straddle the center trench.');
            return;
          }
          
          // DIP-8 U-shape pin mapping:
          // Pins 1-4 (top side): rootRow at col, col+1, col+2, col+3
          // Pins 5-8 (bottom side, reversed): oppositeRow at col+3, col+2, col+1, col
          const pinNodeIds: string[] = [];
          
          // Top side: pins 1-4 (left to right)
          for (let offset = 0; offset < 4; offset++) {
            const targetId = `${rootRow}-${rootCol + offset}`;
            const targetNode = state.nodes.get(targetId);
            if (!targetNode || targetNode.isOccupied) {
              console.warn(`[VBL] DIP-8 placement blocked: node ${targetId} ${!targetNode ? 'does not exist' : 'is occupied'}`);
              return;
            }
            pinNodeIds.push(targetId);
          }
          
          // Bottom side: pins 5-8 (right to left — standard DIP U-shape)
          for (let offset = 3; offset >= 0; offset--) {
            const targetId = `${oppositeRow}-${rootCol + offset}`;
            const targetNode = state.nodes.get(targetId);
            if (!targetNode || targetNode.isOccupied) {
              console.warn(`[VBL] DIP-8 placement blocked: node ${targetId} ${!targetNode ? 'does not exist' : 'is occupied'}`);
              return;
            }
            pinNodeIds.push(targetId);
          }
          
          console.log('[VBL] Placing IC at:', node.id, 'Target Nodes:', pinNodeIds);
          
          // All 8 nodes validated — place the IC
          get().saveSnapshot();
          const componentId = generateId();
          const pins = createComponentPins(state.placementComponent, componentId);
          
          pins.forEach((pin, index) => {
            pin.connectedNodeId = pinNodeIds[index];
          });
          
          // Canvas position: center of the 8-pin footprint
          const topLeft = state.nodes.get(pinNodeIds[0])!;
          const topRight = state.nodes.get(pinNodeIds[3])!;
          const bottomLeft = state.nodes.get(pinNodeIds[7])!;
          const canvasPosition = {
            x: (topLeft.canvasPosition.x + topRight.canvasPosition.x) / 2,
            y: (topLeft.canvasPosition.y + bottomLeft.canvasPosition.y) / 2,
          };
          
          const componentState = getDefaultComponentState(state.placementComponent);
          
          const newComponent: CircuitComponent = {
            id: componentId,
            type: state.placementComponent,
            pins,
            canvasPosition,
            rotation: 0,
            state: componentState,
          };
          
          const updatedNodes = new Map(state.nodes);
          pinNodeIds.forEach((pinNodeId) => {
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
          
          // Sound feedback + animation
          globalSoundSystem.playSnap();
          markAsRecentlyPlaced(componentId, state.recentlyPlacedIds, set);
          
          get().runSimulation();
          return;
        }
        
        // ---- STANDARD 2-PIN PLACEMENT ----
        const newPins = [...state.placementPins, nodeId];
        
        // Check if we have all pins placed
        if (newPins.length >= definition.pinCount) {
          get().saveSnapshot();
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
          
          // Get default component state
          let componentState = getDefaultComponentState(state.placementComponent);
          
          // TRAIT-DRIVEN: Inject selectedColor for components with hasUserColor trait
          const compDef = COMPONENT_DEFINITIONS[state.placementComponent];
          if (compDef?.hasUserColor) {
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
          
          // Sound feedback + animation
          globalSoundSystem.playSnap();
          markAsRecentlyPlaced(componentId, state.recentlyPlacedIds, set);
          
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
        
        get().saveSnapshot();
        
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
        
        // Sound feedback
        globalSoundSystem.playDelete();
        
        get().runSimulation();
      },
      
      selectComponent: (componentId) => {
        // MUTUAL EXCLUSIVITY: Selecting a component clears wire selection
        set({ selectedComponentId: componentId, selectedWireId: null });
      },
      
      toggleSwitch: (componentId) => {
        const state = get();
        const component = state.components.find((c) => c.id === componentId);
        
        // TRAIT-DRIVEN: Check isToggleable trait instead of hardcoded type
        const compDef = component ? COMPONENT_DEFINITIONS[component.type] : null;
        if (!component || !compDef?.isToggleable) return;
        
        get().saveSnapshot();
        
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
      
      // ---- Momentary Button Actions ----
      setButtonPressed: (componentId, pressed) => {
        const state = get();
        const component = state.components.find((c) => c.id === componentId);
        if (!component) return;
        
        const currentState = component.state as Record<string, unknown>;
        // Skip if state hasn't changed
        if (currentState.isActive === pressed) return;
        
        const newComponents = state.components.map((c) => {
          if (c.id === componentId) {
            return {
              ...c,
              state: { ...currentState, isActive: pressed },
            };
          }
          return c;
        });
        
        set({ components: newComponents });
        get().runSimulation();
      },
      
      // ---- Wire Selection ----
      selectWire: (wireId) => {
        // MUTUAL EXCLUSIVITY: Selecting a wire clears component selection
        set({ selectedWireId: wireId, selectedComponentId: null });
      },
      
      // ---- Generic Delete Action ----
      deleteSelected: () => {
        const state = get();
        
        // Delete selected component
        if (state.selectedComponentId) {
          get().removeComponent(state.selectedComponentId);
          return;
        }
        
        // Delete selected wire
        if (state.selectedWireId) {
          get().removeWire(state.selectedWireId);
          return;
        }
      },
      
      // ---- Simulation ----
      runSimulation: () => {
        const state = get();
        const result = evaluateCircuit(state.nodes, state.components, state.wires);
        const newActiveNodes = getActiveNodes(result.activePath, state.nodes);
        
        set({
          simulation: result,
          activeNodes: newActiveNodes,
          positiveNodes: result.positiveReachable,
          negativeNodes: result.negativeReachable,
        });
      },
      
      tick: () => {
        const state = get();
        let anyChanged = false;
        
        // Helper: check if a pin's node reaches a voltage set (connection-group-aware)
        const pinReaches = (pinNodeId: string, voltageSet: Set<string>): boolean => {
          // Direct check first
          if (voltageSet.has(pinNodeId)) return true;
          // Expand through connection group
          const node = state.nodes.get(pinNodeId);
          if (!node) return false;
          // Check all nodes in the same connection group
          for (const [id, n] of state.nodes) {
            if (n.connectionGroup === node.connectionGroup && voltageSet.has(id)) {
              return true;
            }
          }
          return false;
        };
        
        // TRAIT-DRIVEN: Find all timed components and toggle their clock if powered
        const updatedComponents = state.components.map(comp => {
          const compDef = COMPONENT_DEFINITIONS[comp.type];
          if (!compDef?.isTimed) return comp;
          
          // Check if this timed component is powered using last simulation results
          const vccPin = comp.pins.find(p => p.pinType === 'ic-vcc');
          const gndPin = comp.pins.find(p => p.pinType === 'ic-gnd');
          if (!vccPin?.connectedNodeId || !gndPin?.connectedNodeId) return comp;
          
          const vccPowered = pinReaches(vccPin.connectedNodeId, state.positiveNodes);
          const gndPowered = pinReaches(gndPin.connectedNodeId, state.negativeNodes);
          
          if (vccPowered && gndPowered) {
            // Timed component is powered — toggle clock output
            const currentState = comp.state as Record<string, unknown>;
            const newClockState = !currentState.clockState;
            anyChanged = true;
            return {
              ...comp,
              state: {
                ...currentState,
                clockState: newClockState,
              },
            };
          }
          
          // Not powered — ensure clock is off
          const currentState = comp.state as Record<string, unknown>;
          if (currentState.clockState) {
            anyChanged = true;
            return {
              ...comp,
              state: { ...currentState, clockState: false },
            };
          }
          
          return comp;
        });
        
        if (anyChanged) {
          set({ components: updatedComponents });
          get().runSimulation();
        }
      },
      
      // ---- General ----
      clearAll: () => {
        get().saveSnapshot();
        const freshNodes = createBreadboardNodes();
        set({
          ...initialState,
          nodes: freshNodes,
        });
      },
      
      loadCircuit: (components, wires, isHistory = false) => {
        if (!isHistory) get().saveSnapshot();
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
      
      // ---- History Actions ----
      saveSnapshot: () => {
        set((state) => {
          const snapshot = {
            components: JSON.parse(JSON.stringify(state.components)),
            wires: JSON.parse(JSON.stringify(state.wires)),
          };
          return {
            history: {
              past: [...state.history.past, snapshot].slice(-50),
              future: [],
            },
          };
        });
      },
      
      undo: () => {
        const state = get();
        if (state.history.past.length === 0) return;
        
        const past = [...state.history.past];
        const previous = past.pop()!;
        
        const current = {
          components: JSON.parse(JSON.stringify(state.components)),
          wires: JSON.parse(JSON.stringify(state.wires)),
        };
        
        // Set history first so loadCircuit doesn't overwrite it
        set({
          history: {
            past,
            future: [current, ...state.history.future],
          },
        });
        
        get().loadCircuit(previous.components, previous.wires, true);
      },
      
      redo: () => {
        const state = get();
        if (state.history.future.length === 0) return;
        
        const future = [...state.history.future];
        const next = future.shift()!;
        
        const current = {
          components: JSON.parse(JSON.stringify(state.components)),
          wires: JSON.parse(JSON.stringify(state.wires)),
        };
        
        // Set history first so loadCircuit doesn't overwrite it
        set({
          history: {
            past: [...state.history.past, current],
            future,
          },
        });
        
        get().loadCircuit(next.components, next.wires, true);
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
      
      // ---- Onboarding Tour Actions ----
      startTour: () => {
        set({ isTourRunning: true });
      },
      
      stopTour: () => {
        set({ isTourRunning: false });
      },
      
      // ---- Export / Import ----
      exportCircuit: () => {
        const state = get();
        const exportData: SerializedState = {
          version: 1,
          components: state.components.map(serializeComponent),
          wires: state.wires.map(w => ({
            id: w.id,
            startNodeId: w.startNodeId,
            endNodeId: w.endNodeId,
            color: w.color,
          })),
        };
        
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'circuit.json';
        anchor.click();
        URL.revokeObjectURL(url);
      },
      
      importCircuit: (jsonString: string) => {
        try {
          const parsed = JSON.parse(jsonString) as SerializedState;
          
          if (!parsed.version || !Array.isArray(parsed.components) || !Array.isArray(parsed.wires)) {
            console.error('[VBL] Invalid circuit file format');
            return;
          }
          
          const freshNodes = createBreadboardNodes();
          
          // Deserialize components
          const components: CircuitComponent[] = [];
          for (const sc of parsed.components) {
            const component = deserializeComponent(sc, freshNodes);
            if (component) {
              components.push(component);
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
          
          // Validate wires
          const wires: Wire[] = parsed.wires.filter(w =>
            freshNodes.has(w.startNodeId) && freshNodes.has(w.endNodeId)
          );
          
          // Overwrite state, clear history
          set({
            nodes: freshNodes,
            components,
            wires,
            selectedComponentId: null,
            selectedWireId: null,
            placementComponent: null,
            placementPins: [],
            history: { past: [], future: [] },
          });
          
          get().runSimulation();
        } catch (e) {
          console.error('[VBL] Failed to import circuit:', e);
        }
      },
      
      // ---- Clipboard Actions ----
      copyCircuitToClipboard: async (): Promise<boolean> => {
        try {
          const { components, wires } = get();
          const exportData: SerializedState = {
            version: 1,
            components: components.map(serializeComponent),
            wires: wires.map(w => ({
              id: w.id,
              startNodeId: w.startNodeId,
              endNodeId: w.endNodeId,
              color: w.color,
            })),
          };
          const json = JSON.stringify(exportData, null, 2);
          await navigator.clipboard.writeText(json);
          console.log('[VBL] Circuit copied to clipboard');
          return true;
        } catch (e) {
          console.error('[VBL] Failed to copy circuit to clipboard:', e);
          return false;
        }
      },
      
      pasteCircuitFromClipboard: async (): Promise<boolean> => {
        try {
          const clipboardText = await navigator.clipboard.readText();
          const parsed = JSON.parse(clipboardText) as SerializedState;
          
          // Validate VBL JSON format
          if (!parsed.version || !Array.isArray(parsed.components) || !Array.isArray(parsed.wires)) {
            console.error('[VBL] Invalid VBL JSON format in clipboard');
            return false;
          }
          
          // Reuse existing importCircuit logic
          get().importCircuit(clipboardText);
          console.log('[VBL] Circuit pasted from clipboard');
          return true;
        } catch (e) {
          console.error('[VBL] Failed to paste circuit from clipboard:', e);
          return false;
        }
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
export const useNodes = () => useCircuitStore(useShallow((state) => state.nodes));
export const useComponents = () => useCircuitStore(useShallow((state) => state.components));
export const useWires = () => useCircuitStore(useShallow((state) => state.wires));
export const useSelectedTool = () => useCircuitStore((state) => state.selectedTool);
export const useSimulation = () => useCircuitStore(useShallow((state) => state.simulation));
export const useActiveNodes = () => useCircuitStore(useShallow((state) => state.activeNodes));
export const usePositiveNodes = () => useCircuitStore(useShallow((state) => state.positiveNodes));
export const useNegativeNodes = () => useCircuitStore(useShallow((state) => state.negativeNodes));

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
