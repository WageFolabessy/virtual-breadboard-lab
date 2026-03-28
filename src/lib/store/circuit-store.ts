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
// Keys that are purely numerical display values and not used by the engine
const NUMERICAL_DISPLAY_KEYS = new Set(['voltage', 'resistance', 'capacitance', 'frequency']);

function serializeComponent(component: CircuitComponent): SerializedComponent {
  // Strip numerical display values from exported state
  const rawState = component.state as Record<string, unknown>;
  const cleanState: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawState)) {
    if (!NUMERICAL_DISPLAY_KEYS.has(key)) {
      cleanState[key] = value;
    }
  }
  
  return {
    id: component.id,
    type: component.type,
    pinNodeIds: component.pins.map(p => p.connectedNodeId),
    state: cleanState,
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
  selectedWireId: string | null;
  wireStartNodeId: string | null;
  
  // Wire relocation mode
  movingWireId: string | null;
  movingWireEndpoint: 'start' | 'end' | null;
  
  // Component relocation mode
  movingComponentId: string | null;
  
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
  
  // System message (toast notification — replaces blocking alert())
  systemMessage: string | null;
  
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
  
  // System Message Actions
  setSystemMessage: (msg: string | null) => void;
  
  // Wire Relocation Actions
  startMoveWireEndpoint: (wireId: string, endpoint: 'start' | 'end') => void;
  finishMoveWireEndpoint: (newNodeId: string) => void;
  cancelMoveWireEndpoint: () => void;
  
  // Component Relocation Actions
  liftComponent: (componentId: string) => void;
  placeMovedComponent: (targetNodeIds: string[]) => void;
  cancelMoveComponent: () => void;
  
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
  systemMessage: null,
  movingWireId: null,
  movingWireEndpoint: null,
  movingComponentId: null,
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
        
        // ---- Wire Relocation: intercept click when moving a wire endpoint ----
        if (state.movingWireId) {
          state.finishMoveWireEndpoint(nodeId);
          return;
        }
        
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
            // User clicked a non-trench row — notify via toast
            get().setSystemMessage('IC must be placed on Row E or Row F to straddle the center trench.');
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
        
        // ---- STANDARD MULTI-CLICK PLACEMENT ----
        const newPins = [...state.placementPins, nodeId];
        
        // Basic components take N clicks (where N = pinCount).
        // Tactile button mathematically infers 2 pins from 2 clicks despite pinCount=4.
        const clicksNeeded = state.placementComponent === 'tactile_button' ? 2 : definition.pinCount;
        
        // Check if we have all clicks placed
        if (newPins.length >= clicksNeeded) {
          get().saveSnapshot();
          
          let pinNodeIds = [...newPins];
          
          // ---- TACTILE BUTTON DYNAMIC PLACEMENT ----
          if (state.placementComponent === 'tactile_button') {
            const [node1, node2] = newPins;
            const [row1Str, col1Str] = node1.split('-');
            const [row2Str, col2Str] = node2.split('-');
            
            // Infer bottom rows (shift char code down by 1)
            const bottomRow1 = String.fromCharCode(row1Str.charCodeAt(0) + 1);
            const bottomRow2 = String.fromCharCode(row2Str.charCodeAt(0) + 1);
            
            const node3 = `${bottomRow1}-${col1Str}`;
            const node4 = `${bottomRow2}-${col2Str}`;
            
            // Pin mapping: tb-top-left, tb-bottom-left, tb-top-right, tb-bottom-right
            // Matches sequence in createComponentPins
            pinNodeIds = [node1, node3, node2, node4];
            
            // Validate all 4 nodes
            for (const targetId of pinNodeIds) {
              const targetNode = state.nodes.get(targetId);
              if (!targetNode || targetNode.isOccupied) {
                console.warn(`[VBL] Tactile button placement blocked: node ${targetId} ${!targetNode ? 'does not exist' : 'is occupied'}`);
                set({ placementPins: [] }); // Reset clicks if blocked
                // Revert snapshot because we aborted component creation
                const prevState = get().history.past.pop();
                if (prevState) {
                  set((s) => ({ ...s, ...prevState }));
                }
                get().setSystemMessage('Invalid placement. All 4 pins must fit on empty breadboard nodes.');
                return;
              }
            }
          }
          
          // Create the component
          const componentId = generateId();
          const pins = createComponentPins(state.placementComponent, componentId);
          
          // Connect pins to nodes
          pins.forEach((pin, index) => {
            pin.connectedNodeId = pinNodeIds[index];
          });
          
          // Calculate canvas position (center of the component based on all pins)
          const firstNode = state.nodes.get(pinNodeIds[0])!;
          const lastNode = state.nodes.get(pinNodeIds[pinNodeIds.length - 1])!;
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
        
        // === STATE WRITE-BACK (Critical for Memory Circuits) ===
        // The evaluator computes transistor isOn states via Asynchronous Relaxation,
        // but stores them in result.componentStates (a temporary Map).
        // We MUST write these states back to the actual component objects in the store
        // so that the NEXT evaluation frame can read the previous transistor states
        // as seeds for the relaxation solver. Without this, flip-flops/latches
        // lose their memory every frame and cannot latch.
        let componentsUpdated = false;
        const updatedComponents = state.components.map(comp => {
          const evaluatedState = result.componentStates.get(comp.id);
          if (!evaluatedState) return comp;
          
          const currentState = comp.state as Record<string, unknown>;
          const newState = evaluatedState as Record<string, unknown>;
          
          // Check if any state property actually changed
          let changed = false;
          for (const key of Object.keys(newState)) {
            if (currentState[key] !== newState[key]) {
              changed = true;
              break;
            }
          }
          
          if (changed) {
            componentsUpdated = true;
            return { ...comp, state: evaluatedState };
          }
          return comp;
        });
        
        set({
          simulation: result,
          activeNodes: newActiveNodes,
          positiveNodes: result.positiveReachable,
          negativeNodes: result.negativeReachable,
          ...(componentsUpdated ? { components: updatedComponents } : {}),
        });
      },
      
      tick: () => {
        const state = get();
        let anyChanged = false;
        
        // Build connection-group cache ONCE per tick — O(N) amortized
        // This replaces the old O(N)-per-call iteration of the entire nodes Map.
        const groupToNodes = new Map<string, string[]>();
        state.nodes.forEach((node, id) => {
          const group = node.connectionGroup;
          if (!groupToNodes.has(group)) groupToNodes.set(group, []);
          groupToNodes.get(group)!.push(id);
        });
        
        // O(group_size) per call — typically ~5 nodes per terminal strip
        const pinReaches = (pinNodeId: string, voltageSet: Set<string>): boolean => {
          // Direct check first (O(1))
          if (voltageSet.has(pinNodeId)) return true;
          // Expand through connection group using pre-built cache
          const node = state.nodes.get(pinNodeId);
          if (!node) return false;
          const groupMembers = groupToNodes.get(node.connectionGroup);
          if (!groupMembers) return false;
          return groupMembers.some(id => voltageSet.has(id));
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
      
      // ---- System Message Actions ----
      setSystemMessage: (msg) => {
        set({ systemMessage: msg });
        if (msg !== null) {
          // Auto-dismiss after 3 seconds
          setTimeout(() => {
            // Only clear if the message hasn't been replaced
            if (get().systemMessage === msg) {
              set({ systemMessage: null });
            }
          }, 3000);
        }
      },
      
      // ---- Wire Relocation Actions ----
      startMoveWireEndpoint: (wireId, endpoint) => {
        const state = get();
        const wire = state.wires.find(w => w.id === wireId);
        if (!wire) return;
        
        // Determine the anchor node (the end that stays fixed)
        const anchorNodeId = endpoint === 'start' ? wire.endNodeId : wire.startNodeId;
        
        set({
          movingWireId: wireId,
          movingWireEndpoint: endpoint,
          // Clear any existing selections
          selectedComponentId: null,
          selectedWireId: wireId,
        });
        
        // Reuse existing wire drawing preview from anchor node
        startWireDrawing(anchorNodeId);
      },
      
      finishMoveWireEndpoint: (newNodeId) => {
        const state = get();
        const { movingWireId, movingWireEndpoint } = state;
        if (!movingWireId || !movingWireEndpoint) return;
        
        const wire = state.wires.find(w => w.id === movingWireId);
        if (!wire) {
          state.cancelMoveWireEndpoint();
          return;
        }
        
        // Don't allow connecting both ends to same node
        const anchorNodeId = movingWireEndpoint === 'start' ? wire.endNodeId : wire.startNodeId;
        if (newNodeId === anchorNodeId) {
          state.cancelMoveWireEndpoint();
          return;
        }
        
        // Check if this would duplicate an existing wire
        const wouldDuplicate = state.wires.some(w => {
          if (w.id === movingWireId) return false;
          return (
            (w.startNodeId === anchorNodeId && w.endNodeId === newNodeId) ||
            (w.startNodeId === newNodeId && w.endNodeId === anchorNodeId)
          );
        });
        
        if (wouldDuplicate) {
          state.cancelMoveWireEndpoint();
          get().setSystemMessage('A wire already connects these two nodes.');
          return;
        }
        
        get().saveSnapshot();
        
        // Update the wire endpoint
        const updatedWires = state.wires.map(w => {
          if (w.id !== movingWireId) return w;
          if (movingWireEndpoint === 'start') {
            return { ...w, startNodeId: newNodeId };
          } else {
            return { ...w, endNodeId: newNodeId };
          }
        });
        
        stopWireDrawing();
        
        set({
          wires: updatedWires,
          movingWireId: null,
          movingWireEndpoint: null,
        });
        
        get().runSimulation();
      },
      
      cancelMoveWireEndpoint: () => {
        stopWireDrawing();
        set({
          movingWireId: null,
          movingWireEndpoint: null,
        });
      },
      
      // ---- Component Relocation Actions ----
      liftComponent: (componentId) => {
        const state = get();
        const component = state.components.find(c => c.id === componentId);
        if (!component) return;
        
        get().saveSnapshot();
        
        // Collect original pin node IDs for revert
        const originalPinNodeIds = component.pins.map(p => p.connectedNodeId ?? '');
        
        // Free all nodes occupied by this component
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
          nodes: updatedNodes,
          movingComponentId: componentId,
          selectedComponentId: componentId,
        });
        
        // Start isolated drag state
        startComponentDrag(componentId, originalPinNodeIds);
      },
      
      placeMovedComponent: (targetNodeIds) => {
        const state = get();
        const { movingComponentId } = state;
        if (!movingComponentId) return;
        
        const component = state.components.find(c => c.id === movingComponentId);
        if (!component) {
          state.cancelMoveComponent();
          return;
        }
        
        // Validate: all target nodes must exist and be unoccupied
        const updatedNodes = new Map(state.nodes);
        const allValid = targetNodeIds.every((nodeId) => {
          if (!nodeId) return false;
          const node = updatedNodes.get(nodeId);
          return node && !node.isOccupied;
        });
        
        if (!allValid || targetNodeIds.length !== component.pins.length) {
          // Invalid drop — revert to original position
          state.cancelMoveComponent();
          get().setSystemMessage('Cannot place component here — nodes occupied or out of bounds.');
          return;
        }
        
        // Update component pins to new node IDs
        const updatedComponents = state.components.map(c => {
          if (c.id !== movingComponentId) return c;
          return {
            ...c,
            pins: c.pins.map((pin, i) => ({
              ...pin,
              connectedNodeId: targetNodeIds[i],
            })),
          };
        });
        
        // Mark new nodes as occupied
        targetNodeIds.forEach((nodeId) => {
          const node = updatedNodes.get(nodeId);
          if (node) {
            updatedNodes.set(nodeId, {
              ...node,
              isOccupied: true,
              occupiedBy: movingComponentId,
            });
          }
        });
        
        stopComponentDrag();
        
        set({
          components: updatedComponents,
          nodes: updatedNodes,
          movingComponentId: null,
        });
        
        get().runSimulation();
      },
      
      cancelMoveComponent: () => {
        const dragState = getComponentDragState();
        const state = get();
        
        // Restore original node occupation
        if (dragState.originalPinNodeIds.length > 0 && state.movingComponentId) {
          const updatedNodes = new Map(state.nodes);
          dragState.originalPinNodeIds.forEach((nodeId) => {
            if (!nodeId) return;
            const node = updatedNodes.get(nodeId);
            if (node) {
              updatedNodes.set(nodeId, {
                ...node,
                isOccupied: true,
                occupiedBy: state.movingComponentId!,
              });
            }
          });
          
          set({
            nodes: updatedNodes,
            movingComponentId: null,
          });
        } else {
          set({ movingComponentId: null });
        }
        
        stopComponentDrag();
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

// ---- Isolated Component Drag State (Does NOT trigger component re-renders) ----
// Same pattern as wireDrawingState — ref-based, NOT Zustand
interface ComponentDragState {
  isDragging: boolean;
  componentId: string | null;
  deltaX: number;
  deltaY: number;
  originalPinNodeIds: string[]; // For revert on invalid drop
}

let componentDragState: ComponentDragState = {
  isDragging: false,
  componentId: null,
  deltaX: 0,
  deltaY: 0,
  originalPinNodeIds: [],
};

const componentDragListeners = new Set<() => void>();
let isNotifyingDrag = false;

export function getComponentDragState(): ComponentDragState {
  return componentDragState;
}

export function setComponentDragPosition(deltaX: number, deltaY: number): void {
  if (!componentDragState.isDragging) return;
  if (componentDragState.deltaX === deltaX && componentDragState.deltaY === deltaY) return;
  
  componentDragState = { ...componentDragState, deltaX, deltaY };
  notifyComponentDragListeners();
}

export function startComponentDrag(componentId: string, originalPinNodeIds: string[]): void {
  componentDragState = { isDragging: true, componentId, deltaX: 0, deltaY: 0, originalPinNodeIds };
  notifyComponentDragListeners();
}

export function stopComponentDrag(): void {
  componentDragState = { isDragging: false, componentId: null, deltaX: 0, deltaY: 0, originalPinNodeIds: [] };
  notifyComponentDragListeners();
}

function notifyComponentDragListeners(): void {
  if (isNotifyingDrag) return;
  isNotifyingDrag = true;
  try {
    componentDragListeners.forEach(fn => fn());
  } finally {
    isNotifyingDrag = false;
  }
}

export function subscribeToComponentDrag(listener: () => void): () => void {
  componentDragListeners.add(listener);
  return () => componentDragListeners.delete(listener);
}
