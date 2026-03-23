"use client";

// ============================================
// COMPONENT LIBRARY SIDEBAR
// Sidebar with draggable electronic components
// ============================================

import React from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { ComponentType } from "@/lib/types";
import { COMPONENT_DEFINITIONS, WIRE_COLOR_OPTIONS } from "@/lib/constants";

interface ComponentCardProps {
  type: ComponentType;
  name: string;
  description: string;
  icon: string;
  isSelected: boolean;
  onClick: () => void;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  name,
  description,
  icon,
  isSelected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-lg border-2 transition-all duration-200 text-left
        ${
          isSelected
            ? "border-blue-500 bg-blue-50 shadow-md"
            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 text-sm">{name}</h3>
          <p className="text-xs text-gray-500 truncate">{description}</p>
        </div>
      </div>
    </button>
  );
};

interface WireColorButtonProps {
  color: string;
  name: string;
  isSelected: boolean;
  onClick: () => void;
}

const WireColorButton: React.FC<WireColorButtonProps> = ({
  color,
  name,
  isSelected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      title={name}
      className={`
        w-8 h-8 rounded-full border-2 transition-all duration-150
        ${isSelected ? "border-gray-800 scale-110 ring-2 ring-offset-2 ring-gray-400" : "border-gray-300 hover:scale-105"}
      `}
      style={{ backgroundColor: color }}
    />
  );
};

export const ComponentLibrary: React.FC = () => {
  const {
    selectedTool,
    setSelectedTool,
    selectedWireColor,
    setWireColor,
    placementComponent,
    placementPins,
  } = useCircuitStore();

  const componentTypes: ComponentType[] = ["battery", "led"];

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-bold text-gray-800">Components</h2>
        <p className="text-xs text-gray-500 mt-1">
          Click to place on breadboard
        </p>
      </div>

      {/* Component List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Power & Output
          </h3>
          {componentTypes.map((type) => {
            const def = COMPONENT_DEFINITIONS[type];
            if (!def) return null;

            return (
              <ComponentCard
                key={type}
                type={type}
                name={def.name}
                description={def.description}
                icon={def.icon}
                isSelected={selectedTool === type}
                onClick={() => setSelectedTool(type)}
              />
            );
          })}
        </div>

        {/* Wire & LED Colors */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Wire / LED Color
          </h3>
          <div className="flex flex-wrap gap-2">
            {WIRE_COLOR_OPTIONS.map((option) => (
              <WireColorButton
                key={option.value}
                color={option.value}
                name={option.name}
                isSelected={selectedWireColor === option.value}
                onClick={() => setWireColor(option.value)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Placement Status */}
      {placementComponent && (
        <div className="p-4 bg-blue-50 border-t border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800">
            Placing {COMPONENT_DEFINITIONS[placementComponent]?.name}
          </h3>
          <p className="text-xs text-blue-600 mt-1">
            {placementPins.length === 0
              ? `Click first pin location (+/${placementComponent === "led" ? "anode" : "positive"})`
              : `Click second pin location (-/${placementComponent === "led" ? "cathode" : "negative"})`}
          </p>
          <button
            onClick={() =>
              useCircuitStore.getState().cancelComponentPlacement()
            }
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Cancel placement
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="p-4 bg-gray-100 border-t border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Instructions
        </h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>1. Add a battery (power source)</li>
          <li>2. Add an LED</li>
          <li>3. Connect with wires (W key)</li>
          <li>4. Complete the circuit!</li>
        </ul>
      </div>
    </div>
  );
};

export default ComponentLibrary;
