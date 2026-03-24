"use client";

// ============================================
// COMPONENT INFO PANEL
// Displays details about the selected component
// ============================================
//
// AGENTS.md COMPLIANCE:
// - This is a "dumb" UI component - receives all data via props
// - No direct store access - uses callbacks from parent
// - Reusable and testable in isolation
// ============================================

import React from "react";
import {
  CircuitComponent,
  SimulationResult,
  asBatteryState,
  asLEDState,
  asSwitchState,
  asResistorState,
  asCapacitorState,
  asBuzzerState,
} from "@/lib/types";

// Clean display names for component types
const COMPONENT_DISPLAY_NAMES: Record<string, string> = {
  battery: "Battery",
  led: "LED",
  resistor: "Resistor",
  switch: "Switch",
  capacitor: "Capacitor",
  buzzer: "Buzzer",
};

// Clean display names for pin types
const PIN_DISPLAY_NAMES: Record<string, string> = {
  positive: "Positive",
  negative: "Negative",
  anode: "Anode",
  cathode: "Cathode",
  "terminal-1": "Terminal 1",
  "terminal-2": "Terminal 2",
};

interface ComponentInfoPanelProps {
  component: CircuitComponent;
  simulation: SimulationResult;
  onToggleSwitch: (componentId: string) => void;
  onDelete: (componentId: string) => void;
}

export const ComponentInfoPanel: React.FC<ComponentInfoPanelProps> = ({
  component,
  simulation,
  onToggleSwitch,
  onDelete,
}) => {
  const typeName = COMPONENT_DISPLAY_NAMES[component.type] || component.type;

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">
        Selected {typeName}
      </h3>
      <div className="space-y-2 text-sm">
        {/* Pin Connections */}
        {component.pins.map((pin, index) => (
          <p key={pin.id || index}>
            <span className="text-gray-500">
              {PIN_DISPLAY_NAMES[pin.pinType] || pin.pinType}:
            </span>{" "}
            <span className="font-mono text-xs text-gray-700">
              {pin.connectedNodeId || "Unconnected"}
            </span>
          </p>
        ))}

        {/* Component ID */}
        <p>
          <span className="text-gray-500">ID:</span>{" "}
          <span className="font-mono text-xs text-gray-700">
            {component.id.slice(0, 8)}...
          </span>
        </p>

        {/* Component-specific state info */}
        <ComponentStateInfo
          component={component}
          simulation={simulation}
          onToggleSwitch={onToggleSwitch}
        />

        {/* Delete button */}
        <button
          onClick={() => onDelete(component.id)}
          className="mt-2 w-full px-3 py-2.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 transition-colors cursor-pointer"
        >
          Delete {typeName}
        </button>
      </div>
    </div>
  );
};

// ---- Component State Info (Trait-Driven) ----
interface ComponentStateInfoProps {
  component: CircuitComponent;
  simulation: SimulationResult;
  onToggleSwitch: (componentId: string) => void;
}

const ComponentStateInfo: React.FC<ComponentStateInfoProps> = ({
  component,
  simulation,
  onToggleSwitch,
}) => {
  switch (component.type) {
    case "battery": {
      const state = asBatteryState(component.state);
      return state ? (
        <p>
          <span className="text-gray-500">Voltage:</span>{" "}
          <span className="text-gray-900 font-medium">{state.voltage}V</span>
        </p>
      ) : null;
    }

    case "led": {
      const simState = simulation.componentStates.get(component.id);
      const ledState = simState ? asLEDState(simState) : null;
      return (
        <p>
          <span className="text-gray-500">State:</span>{" "}
          <span
            className={`font-medium ${
              ledState?.isLit ? "text-green-600" : "text-gray-400"
            }`}
          >
            {ledState?.isLit ? "ON" : "OFF"}
          </span>
        </p>
      );
    }

    case "switch": {
      const switchState = asSwitchState(component.state);
      return (
        <>
          <p>
            <span className="text-gray-500">State:</span>{" "}
            <span
              className={`font-medium ${
                switchState?.isClosed ? "text-green-600" : "text-gray-400"
              }`}
            >
              {switchState?.isClosed ? "CLOSED" : "OPEN"}
            </span>
          </p>
          <button
            onClick={() => onToggleSwitch(component.id)}
            className="mt-2 w-full px-3 py-2.5 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100 transition-colors cursor-pointer"
          >
            Toggle Switch
          </button>
        </>
      );
    }

    case "resistor": {
      const state = asResistorState(component.state);
      return state ? (
        <p>
          <span className="text-gray-500">Resistance:</span>{" "}
          <span className="text-gray-900 font-medium">{state.resistance}Ω</span>
        </p>
      ) : null;
    }

    case "capacitor": {
      const state = asCapacitorState(component.state);
      return state ? (
        <p>
          <span className="text-gray-500">Capacitance:</span>{" "}
          <span className="text-gray-900 font-medium">
            {state.capacitance}µF
          </span>
        </p>
      ) : null;
    }

    case "buzzer": {
      const simState = simulation.componentStates.get(component.id);
      const buzzerState = simState ? asBuzzerState(simState) : null;
      return (
        <p>
          <span className="text-gray-500">State:</span>{" "}
          <span
            className={`font-medium ${
              buzzerState?.isActive ? "text-yellow-600" : "text-gray-400"
            }`}
          >
            {buzzerState?.isActive ? "BUZZING" : "SILENT"}
          </span>
        </p>
      );
    }

    default:
      return null;
  }
};

export default ComponentInfoPanel;
