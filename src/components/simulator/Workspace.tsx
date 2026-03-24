"use client";

// ============================================
// WORKSPACE COMPONENT
// Main client component that composes the simulator
// ============================================
//
// PERFORMANCE OPTIMIZATIONS:
// 1. Wire preview uses isolated ref-based state (no React re-renders)
// 2. Circuit evaluation ONLY runs on finalized actions (mouseUp)
// 3. Memoized selectors prevent cascade re-renders
// 4. All logic extracted into dedicated hooks — this component is pure rendering
// ============================================

import React, { useSyncExternalStore } from "react";
import {
  useCircuitStore,
  getWireDrawingState,
  subscribeToWireDrawing,
} from "@/lib/store/circuit-store";
import { useShallow } from "zustand/react/shallow";
import {
  asBatteryState,
  asLEDState,
  asSwitchState,
  asResistorState,
  asCapacitorState,
  asBuzzerState,
} from "@/lib/types";
import { RENDER } from "@/lib/constants";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { KbdShortcut } from "@/components/ui/KbdShortcut";
import { Breadboard } from "./Breadboard";
import { Toolbar } from "./Toolbar";
import { ComponentLibrary } from "./ComponentLibrary";
import { Wire, WirePreview } from "./Wire";
import {
  Battery,
  LED,
  Resistor,
  Switch,
  Capacitor,
  Buzzer,
} from "./electronics";
import { Header } from "@/components/Header";
import { useHydration } from "@/hooks/useHydration";
import {
  useCircuitActions,
  useComponentActiveChecker,
} from "@/hooks/useCircuitActions";
import { useCanvasInteraction } from "@/hooks/useCanvasInteraction";

// ---- Isolated Wire Preview Component ----
// Uses useSyncExternalStore to subscribe to ref-based state without triggering parent re-renders
// CRITICAL: Does NOT receive nodes Map as prop — queries specific node via getState()
const IsolatedWirePreview: React.FC<{ color: string }> = React.memo(
  ({ color }) => {
    const wireDrawing = useSyncExternalStore(
      subscribeToWireDrawing,
      getWireDrawingState,
      getWireDrawingState,
    );

    if (!wireDrawing.isDrawing || !wireDrawing.startNodeId) return null;

    const startNode = useCircuitStore
      .getState()
      .nodes.get(wireDrawing.startNodeId);
    if (!startNode) return null;

    return (
      <WirePreview
        startNode={startNode}
        currentX={wireDrawing.currentX}
        currentY={wireDrawing.currentY}
        color={color}
      />
    );
  },
);
IsolatedWirePreview.displayName = "IsolatedWirePreview";

// ---- Main Workspace Component ----
export const Workspace: React.FC = () => {
  // ---- State subscriptions ----
  // Bundle reference-type selectors (Map/Array/Set) with useShallow
  const { nodes, components, wires, simulation, activeNodes } = useCircuitStore(
    useShallow((state) => ({
      nodes: state.nodes,
      components: state.components,
      wires: state.wires,
      simulation: state.simulation,
      activeNodes: state.activeNodes,
    })),
  );
  // Primitive selectors use strict equality — no useShallow needed
  const wireStartNodeId = useCircuitStore((state) => state.wireStartNodeId);
  const selectedColor = useCircuitStore((state) => state.selectedColor);
  const selectedComponentId = useCircuitStore(
    (state) => state.selectedComponentId,
  );

  // ---- Hooks ----
  const { isInitialized } = useHydration();
  const { selectComponent, removeWire, toggleSwitch, removeComponent } =
    useCircuitActions();
  const isComponentActive = useComponentActiveChecker(components, activeNodes);
  const { svgRef, handleMouseMove, handleSvgClick } = useCanvasInteraction(
    wireStartNodeId,
    () => selectComponent(null),
  );

  // ---- Loading gate ----
  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">
          Loading Virtual Breadboard Lab (VBL)...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header />
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <ComponentLibrary />

        {/* Main Canvas Area */}
        <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* SVG Canvas */}
            <svg
              ref={svgRef}
              width={RENDER.BOARD_WIDTH}
              height={RENDER.BOARD_HEIGHT}
              viewBox={`0 0 ${RENDER.BOARD_WIDTH} ${RENDER.BOARD_HEIGHT}`}
              onMouseMove={handleMouseMove}
              onClick={handleSvgClick}
              className="block"
            >
              <Breadboard />

              {/* Wires Layer */}
              <g className="wires-layer">
                {wires.map((wire) => {
                  const isActive =
                    activeNodes.has(wire.startNodeId) &&
                    activeNodes.has(wire.endNodeId);

                  return (
                    <Wire
                      key={wire.id}
                      wire={wire}
                      nodes={nodes}
                      isActive={isActive}
                      onDelete={removeWire}
                    />
                  );
                })}

                <IsolatedWirePreview color={selectedColor} />
              </g>

              {/* Components Layer */}
              <g className="components-layer">
                {components.map((component) => {
                  const isSelected = selectedComponentId === component.id;
                  const isActive = isComponentActive(component.id);

                  if (component.type === "battery") {
                    return (
                      <Battery
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        onClick={() => selectComponent(component.id)}
                      />
                    );
                  }

                  if (component.type === "led") {
                    const simState = simulation.componentStates.get(
                      component.id,
                    );
                    const ledState = simState ? asLEDState(simState) : null;

                    return (
                      <LED
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isLit={ledState?.isLit ?? false}
                        onClick={() => selectComponent(component.id)}
                      />
                    );
                  }

                  if (component.type === "resistor") {
                    return (
                      <Resistor
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isActive={isActive}
                        onClick={() => selectComponent(component.id)}
                      />
                    );
                  }

                  if (component.type === "switch") {
                    const switchState = asSwitchState(component.state);
                    return (
                      <Switch
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isActive={isActive && (switchState?.isClosed ?? false)}
                        onToggle={() => toggleSwitch(component.id)}
                        onClick={() => selectComponent(component.id)}
                      />
                    );
                  }

                  if (component.type === "capacitor") {
                    return (
                      <Capacitor
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isActive={isActive}
                        onClick={() => selectComponent(component.id)}
                      />
                    );
                  }

                  if (component.type === "buzzer") {
                    const simState = simulation.componentStates.get(
                      component.id,
                    );
                    const buzzerState = simState
                      ? asBuzzerState(simState)
                      : null;

                    return (
                      <Buzzer
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isActive={buzzerState?.isActive ?? false}
                        onClick={() => selectComponent(component.id)}
                      />
                    );
                  }

                  return null;
                })}
              </g>
            </svg>

            {/* Status Bar */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
              <div>
                Components: {components.length} | Wires: {wires.length}
              </div>
              <div className="flex items-center gap-4">
                <KbdShortcut shortcut="V" label="Select" />
                <KbdShortcut shortcut="W" label="Wire" />
                <KbdShortcut shortcut="D" label="Delete" />
                <KbdShortcut shortcut="ESC" label="Cancel" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Info/Properties */}
        <div className="w-64 bg-gray-50 border-l border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Circuit Info</h2>

          <StatusIndicator
            status={simulation.status}
            message={simulation.message}
          />

          {/* Selected Component Info */}
          {selectedComponentId &&
            (() => {
              const component = components.find(
                (c) => c.id === selectedComponentId,
              );
              if (!component) return null;

              return (
                <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    Selected Component
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-gray-500">Type:</span>{" "}
                      <span className="font-medium capitalize">
                        {component.type}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">ID:</span>{" "}
                      <span className="font-mono text-xs">
                        {component.id.slice(0, 8)}...
                      </span>
                    </p>
                    {component.type === "battery" &&
                      (() => {
                        const state = asBatteryState(component.state);
                        return state ? (
                          <p>
                            <span className="text-gray-500">Voltage:</span>{" "}
                            <span className="font-medium">
                              {state.voltage}V
                            </span>
                          </p>
                        ) : null;
                      })()}
                    {component.type === "led" &&
                      (() => {
                        const simState = simulation.componentStates.get(
                          component.id,
                        );
                        const ledState = simState ? asLEDState(simState) : null;
                        return (
                          <p>
                            <span className="text-gray-500">State:</span>{" "}
                            <span
                              className={`font-medium ${
                                ledState?.isLit
                                  ? "text-green-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {ledState?.isLit ? "ON" : "OFF"}
                            </span>
                          </p>
                        );
                      })()}
                    {component.type === "switch" &&
                      (() => {
                        const switchState = asSwitchState(component.state);
                        return (
                          <>
                            <p>
                              <span className="text-gray-500">State:</span>{" "}
                              <span
                                className={`font-medium ${
                                  switchState?.isClosed
                                    ? "text-green-600"
                                    : "text-gray-500"
                                }`}
                              >
                                {switchState?.isClosed ? "CLOSED" : "OPEN"}
                              </span>
                            </p>
                            <button
                              onClick={() => toggleSwitch(component.id)}
                              className="w-full px-3 py-1.5 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100 transition-colors"
                            >
                              Toggle Switch
                            </button>
                          </>
                        );
                      })()}
                    {component.type === "resistor" &&
                      (() => {
                        const state = asResistorState(component.state);
                        return state ? (
                          <p>
                            <span className="text-gray-500">Resistance:</span>{" "}
                            <span className="font-medium">
                              {state.resistance}Ω
                            </span>
                          </p>
                        ) : null;
                      })()}
                    {component.type === "capacitor" &&
                      (() => {
                        const state = asCapacitorState(component.state);
                        return state ? (
                          <p>
                            <span className="text-gray-500">Capacitance:</span>{" "}
                            <span className="font-medium">
                              {state.capacitance}µF
                            </span>
                          </p>
                        ) : null;
                      })()}
                    {component.type === "buzzer" &&
                      (() => {
                        const simState = simulation.componentStates.get(
                          component.id,
                        );
                        const buzzerState = simState
                          ? asBuzzerState(simState)
                          : null;
                        return (
                          <p>
                            <span className="text-gray-500">State:</span>{" "}
                            <span
                              className={`font-medium ${
                                buzzerState?.isActive
                                  ? "text-yellow-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {buzzerState?.isActive ? "BUZZING" : "SILENT"}
                            </span>
                          </p>
                        );
                      })()}
                    <button
                      onClick={() => removeComponent(selectedComponentId)}
                      className="mt-2 w-full px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 transition-colors"
                    >
                      Delete Component
                    </button>
                  </div>
                </div>
              );
            })()}

          {/* Help */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              Quick Start
            </h3>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Select Battery from sidebar</li>
              <li>Click two nodes on breadboard</li>
              <li>Select LED from sidebar</li>
              <li>Click two nodes for LED</li>
              <li>Press W and draw wires</li>
              <li>Connect + to LED anode</li>
              <li>Connect LED cathode to -</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
