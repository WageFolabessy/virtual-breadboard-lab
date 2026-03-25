"use client";

// ============================================
// COMPONENT LIBRARY SIDEBAR
// Sidebar with draggable electronic components
// ============================================
//
// AGENTS.md COMPLIANCE:
// - Categories are generated DYNAMICALLY from COMPONENT_DEFINITIONS
// - No hardcoded component type arrays
// - Uses trait-driven grouping via 'category' property
// ============================================

import React, { useMemo } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { useShallow } from "zustand/react/shallow";
import {
  ComponentType,
  ComponentCategory,
  CATEGORY_DISPLAY_NAMES,
} from "@/lib/types";
import { COMPONENT_DEFINITIONS, COLOR_PALETTE } from "@/lib/constants";
import { ColorSwatchButton, SectionHeader } from "@/components/ui";
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
        <span className="text-2xl" role="img" aria-label={name}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 text-sm">{name}</h3>
          <p className="text-xs text-gray-500 truncate">{description}</p>
        </div>
      </div>
    </button>
  );
};

// ---- Category order for display ----
const CATEGORY_ORDER: ComponentCategory[] = [
  "power",
  "output",
  "passive",
  "control",
  "ic",
];

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

  // ---- TRAIT-DRIVEN: Group components by category from COMPONENT_DEFINITIONS ----
  const componentsByCategory = useMemo(() => {
    const groups: Record<ComponentCategory, ComponentType[]> = {
      power: [],
      output: [],
      passive: [],
      control: [],
      ic: [],
    };

    Object.values(COMPONENT_DEFINITIONS).forEach((def) => {
      if (def.category && def.category in groups) {
        groups[def.category].push(def.type);
      }
    });

    return groups;
  }, []);

  return (
    <div className="w-full lg:w-64 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col max-h-48 lg:max-h-full lg:h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-bold text-gray-800">Components</h2>
        <p className="text-xs text-gray-500 mt-1">
          Click to place on breadboard
        </p>
      </div>

      {/* Component List — Dynamically grouped by category */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const componentsInCategory = componentsByCategory[category];
          if (componentsInCategory.length === 0) return null;

          return (
            <div key={category} className="space-y-2">
              <SectionHeader>{CATEGORY_DISPLAY_NAMES[category]}</SectionHeader>
              {componentsInCategory.map((type) => {
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
          );
        })}

        {/* Colors */}
        <div className="pt-4 border-t border-gray-200">
          <SectionHeader className="mb-3">Color</SectionHeader>
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
