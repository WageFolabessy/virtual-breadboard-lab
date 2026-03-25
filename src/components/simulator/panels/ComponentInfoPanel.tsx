"use client";

// ============================================
// COMPONENT INFO PANEL
// Displays details about the selected component
// ============================================
//
// AGENTS.md COMPLIANCE:
// - This is a "dumb" UI component - receives all data via props
// - No direct store access - uses callbacks from parent
// - TRAIT-DRIVEN: Uses COMPONENT_DEFINITIONS for display names and state rendering
// - Uses extracted UI components (InfoPanel, PropertyRow, DeleteButton)
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
import { COMPONENT_DEFINITIONS } from "@/lib/constants";
import { InfoPanel, PropertyRow, DeleteButton, PanelButton } from "@/components/ui";

// ---- Pin Display Names (derived from pin types) ----
// This could be moved to COMPONENT_DEFINITIONS if needed
const PIN_DISPLAY_NAMES: Record<string, string> = {
  positive: "Positive",
  negative: "Negative",
  anode: "Anode",
  cathode: "Cathode",
  "terminal-1": "Terminal 1",
  "terminal-2": "Terminal 2",
  collector: "Collector",
  base: "Base",
  emitter: "Emitter",
  "ic-gnd": "GND (Pin 1)",
  "ic-trig": "TRIG (Pin 2)",
  "ic-out": "OUT (Pin 3)",
  "ic-rst": "RST (Pin 4)",
  "ic-ctrl": "CTRL (Pin 5)",
  "ic-thr": "THR (Pin 6)",
  "ic-dis": "DIS (Pin 7)",
  "ic-vcc": "VCC (Pin 8)",
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
  // TRAIT-DRIVEN: Get display name from COMPONENT_DEFINITIONS
  const def = COMPONENT_DEFINITIONS[component.type];
  const typeName = def?.name || component.type;

  return (
    <InfoPanel title={`Selected ${typeName}`}>
      <div className="space-y-2 text-sm">
        {/* Pin Connections */}
        {component.pins.map((pin, index) => (
          <PropertyRow
            key={pin.id || index}
            label={PIN_DISPLAY_NAMES[pin.pinType] || pin.pinType}
            value={pin.connectedNodeId || "Unconnected"}
          />
        ))}

        {/* Component ID */}
        <PropertyRow label="ID" value={`${component.id.slice(0, 8)}...`} />

        {/* TRAIT-DRIVEN: Component-specific state info */}
        <TraitDrivenStateInfo
          component={component}
          simulation={simulation}
          onToggleSwitch={onToggleSwitch}
        />

        {/* Delete button */}
        <DeleteButton
          onClick={() => onDelete(component.id)}
          label={`Delete ${typeName}`}
        />
      </div>
    </InfoPanel>
  );
};

// ============================================
// TRAIT-DRIVEN STATE INFO COMPONENT
// Renders state information based on component traits from COMPONENT_DEFINITIONS
// ============================================

interface TraitDrivenStateInfoProps {
  component: CircuitComponent;
  simulation: SimulationResult;
  onToggleSwitch: (componentId: string) => void;
}

const TraitDrivenStateInfo: React.FC<TraitDrivenStateInfoProps> = ({
  component,
  simulation,
  onToggleSwitch,
}) => {
  const def = COMPONENT_DEFINITIONS[component.type];
  if (!def) return null;

  const componentState = component.state as Record<string, unknown>;
  const simState = simulation.componentStates.get(component.id);
  const stateItems: React.ReactNode[] = [];

  // ---- TRAIT: isPowerSource → Show voltage ----
  if (def.isPowerSource) {
    const batteryState = asBatteryState(component.state);
    if (batteryState) {
      stateItems.push(
        <StateRow key="voltage" label="Voltage" value={`${batteryState.voltage}V`} />
      );
    }
  }

  // ---- TRAIT: isLoad → Show active state from simulation ----
  if (def.isLoad && simState) {
    // Check for LED-specific state (isLit)
    const ledState = asLEDState(simState);
    if (ledState) {
      stateItems.push(
        <StateRow
          key="led-state"
          label="State"
          value={ledState.isLit ? "ON" : "OFF"}
          valueClass={ledState.isLit ? "text-green-600" : "text-gray-400"}
        />
      );
    }

    // Check for Buzzer-specific state (isActive)
    const buzzerState = asBuzzerState(simState);
    if (buzzerState) {
      stateItems.push(
        <StateRow
          key="buzzer-state"
          label="State"
          value={buzzerState.isActive ? "BUZZING" : "SILENT"}
          valueClass={buzzerState.isActive ? "text-yellow-600" : "text-gray-400"}
        />
      );
    }
  }

  // ---- STATE: resistance → Show resistance value ----
  if ('resistance' in componentState) {
    const resistorState = asResistorState(component.state);
    if (resistorState) {
      stateItems.push(
        <StateRow key="resistance" label="Resistance" value={`${resistorState.resistance}Ω`} />
      );
    }
  }

  // ---- STATE: capacitance → Show capacitance value ----
  if ('capacitance' in componentState) {
    const capacitorState = asCapacitorState(component.state);
    if (capacitorState) {
      stateItems.push(
        <StateRow key="capacitance" label="Capacitance" value={`${capacitorState.capacitance}µF`} />
      );
    }
  }

  // ---- STATE: frequency (buzzer) → Show frequency value ----
  if ('frequency' in componentState) {
    const buzzerComponentState = asBuzzerState(component.state);
    if (buzzerComponentState) {
      stateItems.push(
        <StateRow key="frequency" label="Frequency" value={`${buzzerComponentState.frequency} Hz`} />
      );
    }
  }

  // ---- TRAIT: isToggleable → Show switch state + toggle button ----
  if (def.isToggleable && 'isClosed' in componentState) {
    const switchState = asSwitchState(component.state);
    if (switchState) {
      stateItems.push(
        <StateRow
          key="switch-state"
          label="State"
          value={switchState.isClosed ? "CLOSED" : "OPEN"}
          valueClass={switchState.isClosed ? "text-green-600" : "text-gray-400"}
        />
      );
      stateItems.push(
        <PanelButton
          key="toggle-switch"
          onClick={() => onToggleSwitch(component.id)}
          label="Toggle Switch"
          variant="primary"
        />
      );
    }
  }

  return <>{stateItems}</>;
};

// ---- Helper Component: State Row ----
interface StateRowProps {
  label: string;
  value: string;
  valueClass?: string;
}

const StateRow: React.FC<StateRowProps> = ({ label, value, valueClass = "text-gray-900 font-medium" }) => (
  <p>
    <span className="text-gray-500">{label}:</span>{" "}
    <span className={valueClass}>{value}</span>
  </p>
);

export default ComponentInfoPanel;
