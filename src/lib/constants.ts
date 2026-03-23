// ============================================
// BREADBOARD SIMULATOR - CONSTANTS
// ============================================

import { ComponentDefinition } from './types';

// ---- Breadboard Dimensions ----
export const BREADBOARD = {
  // Half-size breadboard: 30 columns
  COLUMNS: 30,
  
  // Terminal rows: A-E (top), F-J (bottom)
  TERMINAL_ROWS_TOP: ['A', 'B', 'C', 'D', 'E'] as const,
  TERMINAL_ROWS_BOTTOM: ['F', 'G', 'H', 'I', 'J'] as const,
  
  // All terminal rows
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
  // Board colors
  BOARD_BACKGROUND: '#E8E4D9',
  BOARD_BORDER: '#8B7355',
  
  // Node colors
  NODE_EMPTY: '#2D2D2D',
  NODE_HOVER: '#4A90D9',
  NODE_OCCUPIED: '#666666',
  NODE_ACTIVE: '#00FF00',  // Node dengan arus
  
  // Rail colors
  POWER_RAIL: '#DC2626',   // Red
  GROUND_RAIL: '#2563EB',  // Blue
  POWER_RAIL_BG: '#FEE2E2',
  GROUND_RAIL_BG: '#DBEAFE',
  
  // Wire colors
  WIRE_DEFAULT: '#374151',
  WIRE_RED: '#DC2626',
  WIRE_BLUE: '#2563EB',
  WIRE_GREEN: '#16A34A',
  WIRE_YELLOW: '#CA8A04',
  WIRE_ORANGE: '#EA580C',
  WIRE_PURPLE: '#9333EA',
  WIRE_BLACK: '#1F2937',
  WIRE_WHITE: '#F3F4F6',
  
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
} as const;

// ---- Wire Color Options ----
export const WIRE_COLOR_OPTIONS = [
  { name: 'Red', value: COLORS.WIRE_RED },
  { name: 'Blue', value: COLORS.WIRE_BLUE },
  { name: 'Green', value: COLORS.WIRE_GREEN },
  { name: 'Yellow', value: COLORS.WIRE_YELLOW },
  { name: 'Orange', value: COLORS.WIRE_ORANGE },
  { name: 'Purple', value: COLORS.WIRE_PURPLE },
  { name: 'Black', value: COLORS.WIRE_BLACK },
  { name: 'White', value: COLORS.WIRE_WHITE },
] as const;

// ---- Component Definitions ----
export const COMPONENT_DEFINITIONS: Record<string, ComponentDefinition> = {
  battery: {
    type: 'battery',
    name: 'Battery (5V)',
    description: 'DC power source providing 5V',
    pinCount: 2,
    pinTypes: ['positive', 'negative'],
    defaultState: { voltage: 5, isOn: true },
    icon: '🔋',
  },
  led: {
    type: 'led',
    name: 'LED',
    description: 'Light Emitting Diode',
    pinCount: 2,
    pinTypes: ['anode', 'cathode'],
    defaultState: { isLit: false, color: '#22C55E' },
    icon: '💡',
  },
  resistor: {
    type: 'resistor',
    name: 'Resistor (220Ω)',
    description: 'Current limiting resistor',
    pinCount: 2,
    pinTypes: ['terminal-1', 'terminal-2'],
    defaultState: { resistance: 220 },
    icon: '⚡',
  },
  switch: {
    type: 'switch',
    name: 'Switch',
    description: 'Toggle switch (click to toggle)',
    pinCount: 2,
    pinTypes: ['terminal-1', 'terminal-2'],
    defaultState: { isClosed: false },
    icon: '🔘',
  },
  capacitor: {
    type: 'capacitor',
    name: 'Capacitor',
    description: 'Stores electrical charge (10µF)',
    pinCount: 2,
    pinTypes: ['positive', 'negative'],
    defaultState: { capacitance: 10 },
    icon: '⚡',
  },
  buzzer: {
    type: 'buzzer',
    name: 'Buzzer',
    description: 'Piezo buzzer (sounds when active)',
    pinCount: 2,
    pinTypes: ['positive', 'negative'],
    defaultState: { isActive: false, frequency: 2000 },
    icon: '🔔',
  },
} as const;

// ---- Local Storage Keys ----
export const STORAGE_KEYS = {
  SAVED_CIRCUITS: 'breadboard-simulator-circuits',
  CURRENT_CIRCUIT: 'breadboard-simulator-current',
  PREFERENCES: 'breadboard-simulator-prefs',
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
} as const;
