// ============================================
// BREADBOARD SIMULATOR - CONSTANTS
// ============================================

import { ComponentDefinition } from './types';

// ---- Breadboard Dimensions ----
export const BREADBOARD = {
  // Full-size MB-102 breadboard: 65 columns (professional engineering standard)
  COLUMNS: 65,
  
  // Terminal rows (top-to-bottom visual order, matching real breadboard silkscreen)
  // Top section: J, I, H, G, F (J at top, F near center trench)
  // Bottom section: E, D, C, B, A (E near center trench, A at bottom)
  TERMINAL_ROWS_TOP: ['J', 'I', 'H', 'G', 'F'] as const,
  TERMINAL_ROWS_BOTTOM: ['E', 'D', 'C', 'B', 'A'] as const,
  
  // All terminal rows (top-to-bottom visual order)
  get TERMINAL_ROWS() {
    return [...this.TERMINAL_ROWS_TOP, ...this.TERMINAL_ROWS_BOTTOM] as const;
  },
  
  // Rail labels
  RAIL_LABELS: {
    POWER: '+',
    GROUND: '-',
  },
} as const;

// ---- SVG Rendering Dimensions ----
export const RENDER = {
  // Node dimensions
  NODE_RADIUS: 4,
  NODE_SPACING: 18,
  NODE_HOVER_RADIUS: 6,
  
  // Padding
  PADDING_X: 60,
  PADDING_Y: 40,
  
  // Rail spacing
  RAIL_GAP: 12,
  SECTION_GAP: 30,  // Gap between top and bottom terminal sections
  
  // Rail to terminal gap
  RAIL_TO_TERMINAL_GAP: 20,
  
  // Calculate total dimensions
  get BOARD_WIDTH() {
    return (BREADBOARD.COLUMNS * this.NODE_SPACING) + (this.PADDING_X * 2);
  },
  
  get BOARD_HEIGHT() {
    // 2 top rails + 5 top terminals + gap + 5 bottom terminals + 2 bottom rails
    const railHeight = 2 * this.NODE_SPACING + this.RAIL_GAP;
    const terminalHeight = 5 * this.NODE_SPACING;
    return (railHeight * 2) + (terminalHeight * 2) + this.SECTION_GAP + (this.PADDING_Y * 2) + (this.RAIL_TO_TERMINAL_GAP * 2);
  },
  
  // Wire styling
  WIRE_WIDTH: 3,
  WIRE_HOVER_WIDTH: 5,
} as const;

// ---- Colors ----
export const COLORS = {
  // Board colors - realistic off-white plastic appearance
  BOARD_BACKGROUND: '#F8F9FA',      // Off-white plastic body
  BOARD_BORDER: '#D1D5DB',          // Light grey edge
  BOARD_SHADOW: 'rgba(0, 0, 0, 0.15)', // Drop shadow for 3D effect
  
  // Node/hole colors - simulating recessed holes in plastic
  NODE_EMPTY: '#1A1A1A',            // Deep dark hole
  NODE_INNER_SHADOW: '#0D0D0D',     // Even darker for inset effect
  NODE_RING: '#2A2A2A',             // Slight ring around hole
  NODE_HOVER: '#4A90D9',            // Highlight on hover
  NODE_OCCUPIED: '#404040',         // Slightly lighter when occupied
  // NODE_ACTIVE removed - use POSITIVE_POTENTIAL/NEGATIVE_POTENTIAL instead
  
  // Rail stripe colors (thin lines like real breadboard)
  POWER_RAIL: '#EF4444',            // Red stripe
  GROUND_RAIL: '#3B82F6',           // Blue stripe
  RAIL_STRIPE_WIDTH: 2,             // Thin stripe line
  
  // Legacy rail BG colors (kept for compatibility but will be replaced)
  POWER_RAIL_BG: 'transparent',
  GROUND_RAIL_BG: 'transparent',
  
  // Palette colors (used for wires, LEDs, and other colorable components)
  PALETTE_RED: '#DC2626',
  PALETTE_BLUE: '#2563EB',
  PALETTE_GREEN: '#16A34A',
  PALETTE_YELLOW: '#CA8A04',
  PALETTE_ORANGE: '#EA580C',
  PALETTE_PURPLE: '#9333EA',
  PALETTE_BLACK: '#1F2937',
  PALETTE_WHITE: '#F3F4F6',
  
  // Component colors
  BATTERY_BODY: '#4A5568',
  BATTERY_POSITIVE: '#DC2626',
  BATTERY_NEGATIVE: '#1F2937',
  LED_BODY: '#D1D5DB',
  LED_ON: '#22C55E',
  LED_OFF: '#6B7280',
  
  // UI colors
  SELECTION_HIGHLIGHT: '#3B82F6',
  DELETE_HIGHLIGHT: '#EF4444',
  
  // Voltage potential indicator colors (glow effect for active voltage)
  // These are the ONLY colors used for circuit activation visualization
  POSITIVE_POTENTIAL: 'rgba(239, 68, 68, 0.7)',   // Red glow (positive voltage)
  NEGATIVE_POTENTIAL: 'rgba(59, 130, 246, 0.7)',  // Blue glow (negative/ground)
  
  // Center trench colors - physical indentation appearance
  CENTER_GAP: '#E5E7EB',            // Light grey trench base
  CENTER_GAP_SHADOW: '#9CA3AF',     // Darker shadow for depth
  CENTER_GAP_HIGHLIGHT: '#FFFFFF',  // Top highlight
  
  // Silkscreen text colors (printed labels)
  SILKSCREEN_TEXT: '#374151',       // Dark grey printed text
  SILKSCREEN_LABEL: '#6B7280',      // Slightly lighter for secondary text
} as const;

// ---- Engine Limits ----
/** Maximum BFS iterations per flood-fill pass. Acts as a safeguard against infinite loops. */
export const MAX_EVALUATION_STEPS = 5000;

// ---- Color Palette Options (for wires, LEDs, and other components) ----
export const COLOR_PALETTE = [
  { name: 'Red', value: COLORS.PALETTE_RED },
  { name: 'Blue', value: COLORS.PALETTE_BLUE },
  { name: 'Green', value: COLORS.PALETTE_GREEN },
  { name: 'Yellow', value: COLORS.PALETTE_YELLOW },
  { name: 'Orange', value: COLORS.PALETTE_ORANGE },
  { name: 'Purple', value: COLORS.PALETTE_PURPLE },
  { name: 'Black', value: COLORS.PALETTE_BLACK },
  { name: 'White', value: COLORS.PALETTE_WHITE },
] as const;

// ---- Component Definitions ----
// TRAIT-DRIVEN: Each component is defined by universal traits (isLoad, isPolarized, etc.)
// The circuit evaluator uses these traits exclusively - NEVER hardcoded type checks.
export const COMPONENT_DEFINITIONS: Record<string, ComponentDefinition> = {
  battery: {
    type: 'battery',
    name: 'Battery',
    description: 'DC power source',
    pinCount: 2,
    pinTypes: ['positive', 'negative'],
    defaultState: { voltage: 5, isOn: true },
    icon: '🔋',
    isLoad: false,
    isPolarized: true,
    isConductive: true,
    isPowerSource: true, // CRITICAL: Seeds flood-fill algorithm
    category: 'power',
  },
  led: {
    type: 'led',
    name: 'LED',
    description: 'Light Emitting Diode',
    pinCount: 2,
    pinTypes: ['anode', 'cathode'],
    defaultState: { isLit: false, color: '#22C55E' },
    icon: '💡',
    isLoad: true,
    isPolarized: true,
    isConductive: false,
    isPowerSource: false,
    category: 'output',
    hasUserColor: true, // Accepts user-selected color during placement
  },
  resistor: {
    type: 'resistor',
    name: 'Resistor',
    description: 'Current limiting resistor',
    pinCount: 2,
    pinTypes: ['terminal-1', 'terminal-2'],
    defaultState: { resistance: 220 },
    icon: '🔧',
    isLoad: true,
    isPolarized: false,
    isConductive: false,
    isPowerSource: false,
    category: 'passive',
  },
  switch: {
    type: 'switch',
    name: 'Push-Button Switch',
    description: 'Click to toggle open/closed',
    pinCount: 2,
    pinTypes: ['terminal-1', 'terminal-2'],
    defaultState: { isClosed: false },
    icon: '🔘',
    isLoad: false,
    isPolarized: false,
    isConductive: true,
    isPowerSource: false,
    category: 'control',
    isToggleable: true, // Can be toggled on/off by user
  },
  capacitor: {
    type: 'capacitor',
    name: 'Capacitor',
    description: 'Electrolytic capacitor — stores charge',
    pinCount: 2,
    pinTypes: ['positive', 'negative'],
    defaultState: { capacitance: 10 },
    icon: '⚡',
    isLoad: true,
    isPolarized: true,
    isConductive: false,
    isPowerSource: false,
    category: 'passive',
  },
  buzzer: {
    type: 'buzzer',
    name: 'Piezo Buzzer',
    description: 'Audible alert — sounds when powered',
    pinCount: 2,
    pinTypes: ['positive', 'negative'],
    defaultState: { isActive: false, frequency: 2000 },
    icon: '🔔',
    isLoad: true,
    isPolarized: true,
    isConductive: false,
    isPowerSource: false,
    category: 'output',
  },
  diode: {
    type: 'diode',
    name: 'Diode',
    description: 'Allows current in one direction only',
    pinCount: 2,
    pinTypes: ['anode', 'cathode'],
    defaultState: { isForwardBiased: false },
    icon: '▶',
    isLoad: false,
    isPolarized: true,
    isConductive: false,
    isPowerSource: false,
    category: 'output',
  },
  npn_transistor: {
    type: 'npn_transistor',
    name: 'NPN Transistor',
    description: 'Current amplifier — 3 pins (C/B/E)',
    pinCount: 3,
    pinTypes: ['collector', 'base', 'emitter'],
    defaultState: { isOn: false, type: 'npn' },
    icon: '🔺',
    isLoad: false,
    isPolarized: true,
    isConductive: false,
    isPowerSource: false,
    category: 'control',
    transistorType: 'npn', // Trait-driven transistor logic
  },
  pnp_transistor: {
    type: 'pnp_transistor',
    name: 'PNP Transistor',
    description: 'Current amplifier — 3 pins (C/B/E)',
    pinCount: 3,
    pinTypes: ['collector', 'base', 'emitter'],
    defaultState: { isOn: false, type: 'pnp' },
    icon: '🔻',
    isLoad: false,
    isPolarized: true,
    isConductive: false,
    isPowerSource: false,
    category: 'control',
    transistorType: 'pnp', // Trait-driven transistor logic
  },
  ic_555: {
    type: 'ic_555',
    name: '555 Timer',
    description: 'DIP-8 timer IC — straddles center trench',
    pinCount: 8,
    pinTypes: ['ic-gnd', 'ic-trig', 'ic-out', 'ic-thr', 'ic-ctrl', 'ic-rst', 'ic-dis', 'ic-vcc'],
    defaultState: { isActive: false, clockState: false },
    icon: '🔲',
    isLoad: true,
    isPolarized: true,
    isConductive: false,
    isPowerSource: false,
    category: 'ic',
    isTimed: true, // Requires periodic tick updates
  },
} as const;

// ---- Local Storage Keys ----
export const STORAGE_KEYS = {
  SAVED_CIRCUITS: 'breadboard-simulator-circuits',
  CURRENT_CIRCUIT: 'breadboard-simulator-current',
  PREFERENCES: 'breadboard-simulator-prefs',
  ONBOARDING_SEEN: 'breadboard-simulator-onboarding-seen',
} as const;

// ---- Keyboard Shortcuts ----
export const SHORTCUTS = {
  SELECT_TOOL: 'v',
  WIRE_TOOL: 'w',
  DELETE_TOOL: 'd',
  ESCAPE: 'Escape',
  UNDO: 'z',
  REDO: 'y',
  SAVE: 's',
  CLEAR: 'Delete',
  COPY: 'c',
  PASTE: 'v',
} as const;
