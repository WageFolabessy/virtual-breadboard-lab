"use client";

// ============================================
// COMPONENT LIBRARY SIDEBAR
// Sidebar with draggable electronic components
// ============================================

import React from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { useShallow } from "zustand/react/shallow";
import { ComponentType } from "@/lib/types";
import { COMPONENT_DEFINITIONS, COLOR_PALETTE } from "@/lib/constants";
import { ColorSwatchButton } from "@/components/ui";
import { useCircuitActions } from "@/hooks/useCircuitActions";

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
      title={`${name} — ${description}`}
      className={`
        w-full p-3 rounded-lg border-2 transition-all duration-200 text-left cursor-pointer
        ${
          isSelected
            ? "border-blue-500 bg-blue-50 shadow-md"
            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm hover:scale-[1.02]"
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

export const ComponentLibrary: React.FC = () => {
  const {
    selectedTool,
    setSelectedTool,
    selectedColor,
    setSelectedColor,
    placementComponent,
    placementPins,
  } = useCircuitStore(
    useShallow((state) => ({
      selectedTool: state.selectedTool,
      setSelectedTool: state.setSelectedTool,
      selectedColor: state.selectedColor,
      setSelectedColor: state.setSelectedColor,
      placementComponent: state.placementComponent,
      placementPins: state.placementPins,
    })),
  );

  const { cancelComponentPlacement } = useCircuitActions();

  return (
    <div className="w-full lg:w-64 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col max-h-48 lg:max-h-full lg:h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-bold text-gray-800">Components</h2>
        <p className="text-xs text-gray-500 mt-1">
          Click to place on breadboard
        </p>
      </div>

      {/* Component List — Grouped by Category */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Power Sources */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Power
          </h3>
          {(["battery"] as ComponentType[]).map((type) => {
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

        {/* Output Components */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Output
          </h3>
          {(["led", "buzzer", "diode"] as ComponentType[]).map((type) => {
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

        {/* Passive Components */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Passive
          </h3>
          {(["resistor", "capacitor"] as ComponentType[]).map((type) => {
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

        {/* Control */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Control
          </h3>
          {(
            ["switch", "npn_transistor", "pnp_transistor"] as ComponentType[]
          ).map((type) => {
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

        {/* Integrated Circuits */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Integrated Circuits
          </h3>
          {(["ic_555"] as ComponentType[]).map((type) => {
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

        {/* Colors */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Color
          </h3>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((option) => (
              <ColorSwatchButton
                key={option.value}
                color={option.value}
                name={option.name}
                isSelected={selectedColor === option.value}
                onClick={() => setSelectedColor(option.value)}
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
            {(() => {
              const def = COMPONENT_DEFINITIONS[placementComponent];
              if (!def) return "Click a node...";
              const pinNames = def.pinTypes;
              return placementPins.length === 0
                ? `Click first pin location (${pinNames[0]})`
                : `Click second pin location (${pinNames[1]})`;
            })()}
          </p>
          <button
            onClick={cancelComponentPlacement}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            Cancel placement
          </button>
        </div>
      )}
    </div>
  );
};

export default ComponentLibrary;
