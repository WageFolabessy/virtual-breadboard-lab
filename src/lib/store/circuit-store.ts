// ============================================
// CIRCUIT STORE (Zustand)
// Central state management for the simulator
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

// ---- Store State Interface ----
interface CircuitStoreState {
  // Breadboard structure
  nodes: Map<string, BreadboardNode>;
  
  // Placed components
  components: CircuitComponent[];
  
  // Wires
  wires: Wire[];
  selectedWireColor: string;
  
  // UI State
  selectedTool: ToolType;
  selectedComponentId: string | null;
  wireStartNodeId: string | null;
  hoveredNodeId: string | null;
  
  // Simulation results
  simulation: SimulationResult;
  activeNodes: Set<string>;
  
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
  setWireColor: (color: string) => void;
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
  selectedWireColor: COLORS.WIRE_RED,
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
  },
  activeNodes: new Set(),
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
      },
      
      endWire: (nodeId) => {
        const state = get();
        const startNodeId = state.wireStartNodeId;
        
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
          color: state.selectedWireColor,
        };
        
        set({
          wires: [...state.wires, newWire],
          wireStartNodeId: null,
        });
        
        // Run simulation after adding wire
        get().runSimulation();
      },
      
      cancelWire: () => set({ wireStartNodeId: null }),
      
      setWireColor: (color) => set({ selectedWireColor: color }),
      
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
          
          const newComponent: CircuitComponent = {
            id: componentId,
            type: state.placementComponent,
            pins,
            canvasPosition,
            rotation: 0,
            state: getDefaultComponentState(state.placementComponent),
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
        const activeNodes = getActiveNodes(result.activePath, state.nodes);
        
        set({
          simulation: result,
          activeNodes,
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
        set({ nodes: createBreadboardNodes() });
      },
    }),
    {
      name: STORAGE_KEYS.CURRENT_CIRCUIT,
      partialize: (state) => ({
        components: state.components,
        wires: state.wires,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reinitialize nodes and run simulation after rehydration
          state.initialize();
          state.runSimulation();
        }
      },
    }
  )
);

// ---- Selector Hooks ----
export const useNodes = () => useCircuitStore((state) => state.nodes);
export const useComponents = () => useCircuitStore((state) => state.components);
export const useWires = () => useCircuitStore((state) => state.wires);
export const useSelectedTool = () => useCircuitStore((state) => state.selectedTool);
export const useSimulation = () => useCircuitStore((state) => state.simulation);
export const useActiveNodes = () => useCircuitStore((state) => state.activeNodes);
