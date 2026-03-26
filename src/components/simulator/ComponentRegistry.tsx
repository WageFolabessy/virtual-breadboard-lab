"use client";

// ============================================
// COMPONENT REGISTRY
// Maps component types to their React renderers
//
// AGENTS.md Compliance:
// - Eliminates hardcoded type checks in Workspace.tsx
// - Uses trait-driven approach via COMPONENT_DEFINITIONS
// - Single source of truth for component rendering
// ============================================

import React from "react";
import {
  CircuitComponent,
  BreadboardNode,
  ComponentType,
  ComponentState,
  asLEDState,
  asSwitchState,
  asBuzzerState,
  asTactileButtonState,
} from "@/lib/types";
import { COMPONENT_DEFINITIONS } from "@/lib/constants";
import {
  Battery,
  LED,
  Resistor,
  Switch,
  Capacitor,
  Buzzer,
  Diode,
  Transistor,
  Timer555,
  TactileButton,
} from "./electronics";

// ---- Renderer Props Interface ----
export interface ComponentRendererProps {
  component: CircuitComponent;
  nodes: Map<string, BreadboardNode>;
  isSelected: boolean;
  isActive: boolean;
  simulationState?: ComponentState;
  onSelect: () => void;
  onToggle?: () => void;
  onPress?: () => void;
  onRelease?: () => void;
  isRecentlyPlaced?: boolean;
}

// ---- Component Renderer Type ----
type ComponentRenderer = (props: ComponentRendererProps) => React.ReactNode;

// ---- Component Registry ----
// Maps each component type to its render function
// Note: 'wire' type is handled separately in Workspace.tsx, not via this registry
const COMPONENT_RENDERERS: Partial<Record<ComponentType, ComponentRenderer>> = {
  battery: ({ component, nodes, isSelected, onSelect }) => (
    <Battery
      key={component.id}
      component={component}
      nodes={nodes}
      isSelected={isSelected}
      onClick={onSelect}
    />
  ),

  led: ({ component, nodes, isSelected, simulationState, onSelect }) => {
    const ledState = simulationState ? asLEDState(simulationState) : null;
    return (
      <LED
        key={component.id}
        component={component}
        nodes={nodes}
        isSelected={isSelected}
        isLit={ledState?.isLit ?? false}
        onClick={onSelect}
      />
    );
  },

  resistor: ({ component, nodes, isSelected, isActive, onSelect }) => (
    <Resistor
      key={component.id}
      component={component}
      nodes={nodes}
      isSelected={isSelected}
      isActive={isActive}
      onClick={onSelect}
    />
  ),

  switch: ({ component, nodes, isSelected, isActive, onSelect, onToggle }) => {
    const switchState = asSwitchState(component.state);
    return (
      <Switch
        key={component.id}
        component={component}
        nodes={nodes}
        isSelected={isSelected}
        isActive={isActive && (switchState?.isClosed ?? false)}
        onToggle={onToggle ?? (() => {})}
        onClick={onSelect}
      />
    );
  },

  capacitor: ({ component, nodes, isSelected, isActive, onSelect }) => (
    <Capacitor
      key={component.id}
      component={component}
      nodes={nodes}
      isSelected={isSelected}
      isActive={isActive}
      onClick={onSelect}
    />
  ),

  buzzer: ({ component, nodes, isSelected, simulationState, onSelect }) => {
    const buzzerState = simulationState ? asBuzzerState(simulationState) : null;
    return (
      <Buzzer
        key={component.id}
        component={component}
        nodes={nodes}
        isSelected={isSelected}
        isActive={buzzerState?.isActive ?? false}
        onClick={onSelect}
      />
    );
  },

  diode: ({ component, nodes, isSelected, isActive, onSelect }) => (
    <Diode
      key={component.id}
      component={component}
      nodes={nodes}
      isSelected={isSelected}
      isActive={isActive}
      onClick={onSelect}
    />
  ),

  npn_transistor: ({ component, nodes, isSelected, isActive, onSelect }) => (
    <Transistor
      key={component.id}
      component={component}
      nodes={nodes}
      isSelected={isSelected}
      isActive={isActive}
      onClick={onSelect}
    />
  ),

  pnp_transistor: ({ component, nodes, isSelected, isActive, onSelect }) => (
    <Transistor
      key={component.id}
      component={component}
      nodes={nodes}
      isSelected={isSelected}
      isActive={isActive}
      onClick={onSelect}
    />
  ),

  ic_555: ({ component, nodes, isSelected, isActive, onSelect }) => (
    <Timer555
      key={component.id}
      component={component}
      nodes={nodes}
      isSelected={isSelected}
      isActive={isActive}
      onClick={onSelect}
    />
  ),

  tactile_button: ({
    component,
    nodes,
    isSelected,
    onSelect,
    onPress,
    onRelease,
  }) => {
    const btnState = asTactileButtonState(component.state);
    return (
      <TactileButton
        key={component.id}
        component={component}
        nodes={nodes}
        isSelected={isSelected}
        isActive={btnState?.isActive ?? false}
        onPress={onPress ?? (() => {})}
        onRelease={onRelease ?? (() => {})}
        onClick={onSelect}
      />
    );
  },
};

// ---- Render Component Function ----
// Universal render function that uses the registry
export function renderComponent(
  props: ComponentRendererProps,
): React.ReactNode {
  const { component, isRecentlyPlaced } = props;
  const renderer = COMPONENT_RENDERERS[component.type];

  if (!renderer) {
    // 'wire' type is handled separately, so it's expected to not have a renderer
    if (component.type !== "wire" && COMPONENT_DEFINITIONS[component.type]) {
      console.warn(
        `Component type "${component.type}" exists in COMPONENT_DEFINITIONS but has no renderer in COMPONENT_RENDERERS`,
      );
    }
    return null;
  }

  const renderedComponent = renderer(props);

  // Wrap with animation group if recently placed
  if (isRecentlyPlaced) {
    return (
      <g key={component.id} className="animate-pop-in">
        {renderedComponent}
      </g>
    );
  }

  return renderedComponent;
}

// ---- Helper to check if a component type has a renderer ----
export function hasRenderer(type: ComponentType): boolean {
  return type in COMPONENT_RENDERERS;
}
