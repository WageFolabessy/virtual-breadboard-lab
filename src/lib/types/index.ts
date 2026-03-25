// ============================================
// BREADBOARD SIMULATOR - TYPE DEFINITIONS
// ============================================

// ---- Position Types ----
export interface Position {
  row: number;
  col: number;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

// ---- Breadboard Node Types ----
export type StripType = 'terminal' | 'power-rail' | 'ground-rail';
export type RailType = 'power' | 'ground';
export type TerminalSection = 'top' | 'bottom'; // A-E is top, F-J is bottom

export interface BreadboardNode {
  id: string;                      // Format: "row-col" e.g., "A-1", "power-top-5"
  position: Position;              // Grid position
  stripType: StripType;
  railType?: RailType;             // Only for rail strips
  section?: TerminalSection;       // Only for terminal strips
  connectionGroup: string;         // Nodes in same group are internally connected
  isOccupied: boolean;
  occupiedBy?: string;             // Component instance ID
  canvasPosition: CanvasPosition;  // SVG rendering position
}

// ---- Electronic Component Types ----
export type ComponentType = 'battery' | 'led' | 'resistor' | 'wire' | 'switch' | 'capacitor' | 'buzzer' | 'diode' | 'npn_transistor' | 'pnp_transistor' | 'ic_555';
export type PinType = 'positive' | 'negative' | 'anode' | 'cathode' | 'terminal-1' | 'terminal-2' | 'collector' | 'base' | 'emitter' | 'ic-gnd' | 'ic-trig' | 'ic-out' | 'ic-rst' | 'ic-ctrl' | 'ic-thr' | 'ic-dis' | 'ic-vcc';

export interface ComponentPin {
  id: string;                      // Format: "{componentId}-{pinType}"
  pinType: PinType;
  connectedNodeId: string | null;  // Connected breadboard node ID
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  pins: ComponentPin[];
  canvasPosition: CanvasPosition;  // Position on the canvas
  rotation: number;                // Rotation in degrees (0, 90, 180, 270)
  state: ComponentState;
}

// Component-specific state types
export interface BatteryState {
  voltage: number;
  isOn: boolean;
}

export interface LEDState {
  isLit: boolean;
  color: string;
}

export interface ResistorState {
  resistance: number;  // in Ohms
}

export interface SwitchState {
  isClosed: boolean;  // closed = conducting, open = not conducting
}

export interface CapacitorState {
  capacitance: number;  // in microfarads (µF)
}

export interface BuzzerState {
  isActive: boolean;
  frequency: number;  // in Hz
}

export interface DiodeState {
  isForwardBiased: boolean;
}

export interface TransistorState {
  isOn: boolean;      // Whether the transistor is conducting (base activated)
  type: 'npn' | 'pnp';
}

export interface IC555State {
  isActive: boolean;
}

export type ComponentState = BatteryState | LEDState | ResistorState | SwitchState | CapacitorState | BuzzerState | DiodeState | TransistorState | IC555State | Record<string, unknown>;

// ---- Wire Types ----
export interface Wire {
  id: string;
  startNodeId: string;
  endNodeId: string;
  color: string;
}

// ---- Circuit Graph Types ----
export interface CircuitGraph {
  adjacencyList: Map<string, Set<string>>;  // Node ID -> Connected Node IDs
}

// ---- Tool Types ----
export type ToolType = 'select' | 'wire' | 'delete' | ComponentType;

// ---- Simulation State ----
export type CircuitStatus = 'incomplete' | 'complete' | 'short-circuit';

export interface SimulationResult {
  status: CircuitStatus;
  isCircuitComplete: boolean;      // backwards compatibility
  activePath: string[];            // Node IDs in the active circuit path
  powerSourceId: string | null;
  componentStates: Map<string, ComponentState>;
  shortCircuitPath?: string[];     // Path that causes short circuit
  message: string;                 // Human-readable status message
  positiveReachable: Set<string>;  // Nodes with positive voltage potential
  negativeReachable: Set<string>;  // Nodes with negative voltage potential
}

// ---- Application State ----
export interface CircuitState {
  // Breadboard structure
  nodes: Map<string, BreadboardNode>;
  nodeGrid: BreadboardNode[][];    // 2D array for easy position access
  
  // Placed components
  components: CircuitComponent[];
  
  // Wires
  wires: Wire[];
  
  // UI State
  selectedTool: ToolType;
  selectedComponentId: string | null;
  wireStartNodeId: string | null;
  
  // Simulation
  simulation: SimulationResult;
}

// ---- Component Definition (for library/palette) ----
export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  description: string;
  pinCount: number;
  pinTypes: PinType[];
  defaultState: ComponentState;
  icon: string;  // SVG path or emoji
  /** True if component consumes power (LED, resistor, buzzer). False for power sources and passthrough. */
  isLoad: boolean;
  /** True if component has directional flow (anode/cathode, +/-). */
  isPolarized: boolean;
  /** True if component passes current when active (wire, switch-closed, battery). */
  isConductive: boolean;
  /** True if component is a power source (battery, power supply). Seeds flood-fill algorithm. */
  isPowerSource: boolean;
}

// ---- Saved Circuit (for localStorage) ----
export interface SavedCircuit {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  components: CircuitComponent[];
  wires: Wire[];
}

// ---- Event Types ----
export interface NodeClickEvent {
  nodeId: string;
  node: BreadboardNode;
  event: React.MouseEvent;
}

export interface ComponentDragEvent {
  componentType: ComponentType;
  position: CanvasPosition;
}

// ---- Type-Safe Component State Getters ----
// Eliminates unsafe inline `as` casts throughout the codebase.

export function asBatteryState(state: ComponentState): BatteryState | null {
  if (state && 'voltage' in state && 'isOn' in state) return state as BatteryState;
  return null;
}

export function asLEDState(state: ComponentState): LEDState | null {
  if (state && 'isLit' in state && 'color' in state) return state as LEDState;
  return null;
}

export function asResistorState(state: ComponentState): ResistorState | null {
  if (state && 'resistance' in state) return state as ResistorState;
  return null;
}

export function asSwitchState(state: ComponentState): SwitchState | null {
  if (state && 'isClosed' in state) return state as SwitchState;
  return null;
}

export function asCapacitorState(state: ComponentState): CapacitorState | null {
  if (state && 'capacitance' in state) return state as CapacitorState;
  return null;
}

export function asBuzzerState(state: ComponentState): BuzzerState | null {
  if (state && 'isActive' in state && 'frequency' in state) return state as BuzzerState;
  return null;
}

export function asDiodeState(state: ComponentState): DiodeState | null {
  if (state && 'isForwardBiased' in state) return state as DiodeState;
  return null;
}

export function asTransistorState(state: ComponentState): TransistorState | null {
  if (state && 'isOn' in state && 'type' in state) return state as TransistorState;
  return null;
}

export function asIC555State(state: ComponentState): IC555State | null {
  if (state && 'isActive' in state && !('frequency' in state) && !('isOn' in state)) return state as IC555State;
  return null;
}
