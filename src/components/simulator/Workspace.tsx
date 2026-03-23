"use client";

// ============================================
// WORKSPACE COMPONENT
// Main client component that composes the simulator
// ============================================

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { LEDState, BuzzerState, SwitchState } from "@/lib/types";
import { RENDER } from "@/lib/constants";
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

export const Workspace: React.FC = () => {
  const {
    nodes,
    components,
    wires,
    wireStartNodeId,
    selectedWireColor,
    selectedComponentId,
    selectComponent,
    removeWire,
    simulation,
    activeNodes,
    initialize,
    runSimulation,
    toggleSwitch,
  } = useCircuitStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initialize();
    runSimulation();
    const timer = setTimeout(() => setIsInitialized(true), 0);
    return () => clearTimeout(timer);
  }, [initialize, runSimulation]);

  // Track mouse position for wire preview
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || !wireStartNodeId) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });
    },
    [wireStartNodeId],
  );

  // Handle click outside components to deselect
  const handleSvgClick = useCallback(() => {
    selectComponent(null);
  }, [selectComponent]);

  // Get wire start node for preview
  const wireStartNode = wireStartNodeId ? nodes.get(wireStartNodeId) : null;

  // Check if component is in active circuit
  const isComponentActive = useCallback(
    (componentId: string) => {
      const component = components.find((c) => c.id === componentId);
      if (!component) return false;

      const connectedPins = component.pins.filter(
        (p) => p.connectedNodeId !== null,
      );
      return connectedPins.every((pin) =>
        activeNodes.has(pin.connectedNodeId!),
      );
    },
    [components, activeNodes],
  );

  // Don't render until initialized (prevents hydration mismatch)
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
      {/* Top Toolbar */}
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Component Library */}
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
              {/* Breadboard Grid */}
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

                {/* Wire Preview */}
                {wireStartNode && (
                  <WirePreview
                    startNode={wireStartNode}
                    currentX={mousePos.x}
                    currentY={mousePos.y}
                    color={selectedWireColor}
                  />
                )}
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
                    const isLit = simState
                      ? (simState as LEDState).isLit
                      : false;

                    return (
                      <LED
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isLit={isLit}
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
                    return (
                      <Switch
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isActive={
                          isActive && (component.state as SwitchState).isClosed
                        }
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
                    const isBuzzing = simState
                      ? (simState as BuzzerState).isActive
                      : false;

                    return (
                      <Buzzer
                        key={component.id}
                        component={component}
                        nodes={nodes}
                        isSelected={isSelected}
                        isActive={isBuzzing}
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
                <span>
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                    V
                  </kbd>{" "}
                  Select
                </span>
                <span>
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                    W
                  </kbd>{" "}
                  Wire
                </span>
                <span>
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                    D
                  </kbd>{" "}
                  Delete
                </span>
                <span>
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                    ESC
                  </kbd>{" "}
                  Cancel
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Info/Properties */}
        <div className="w-64 bg-gray-50 border-l border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Circuit Info</h2>

          {/* Circuit Status */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Status</h3>
            <div
              className={`
                flex items-center gap-2 text-sm font-medium
                ${simulation.status === "complete" ? "text-green-600" : ""}
                ${simulation.status === "incomplete" ? "text-gray-500" : ""}
                ${simulation.status === "short-circuit" ? "text-red-600" : ""}
              `}
            >
              <span
                className={`
                  w-3 h-3 rounded-full
                  ${simulation.status === "complete" ? "bg-green-500" : ""}
                  ${simulation.status === "incomplete" ? "bg-gray-400" : ""}
                  ${simulation.status === "short-circuit" ? "bg-red-500 animate-pulse" : ""}
                `}
              />
              {simulation.status === "complete" && "Complete Circuit"}
              {simulation.status === "incomplete" && "Open Circuit"}
              {simulation.status === "short-circuit" && "SHORT CIRCUIT!"}
            </div>
            {simulation.message && (
              <p
                className={`mt-2 text-xs ${
                  simulation.status === "short-circuit"
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {simulation.message}
              </p>
            )}
          </div>

          {/* Selected Component Info */}
          {selectedComponentId && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Selected Component
              </h3>
              {(() => {
                const component = components.find(
                  (c) => c.id === selectedComponentId,
                );
                if (!component) return null;

                return (
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
                    {component.type === "battery" && (
                      <p>
                        <span className="text-gray-500">Voltage:</span>{" "}
                        <span className="font-medium">
                          {(component.state as { voltage: number }).voltage}V
                        </span>
                      </p>
                    )}
                    {component.type === "led" && (
                      <p>
                        <span className="text-gray-500">State:</span>{" "}
                        <span
                          className={`font-medium ${
                            (
                              simulation.componentStates.get(component.id) as
                                | LEDState
                                | undefined
                            )?.isLit
                              ? "text-green-600"
                              : "text-gray-500"
                          }`}
                        >
                          {(
                            simulation.componentStates.get(component.id) as
                              | LEDState
                              | undefined
                          )?.isLit
                            ? "ON"
                            : "OFF"}
                        </span>
                      </p>
                    )}
                    {component.type === "switch" && (
                      <>
                        <p>
                          <span className="text-gray-500">State:</span>{" "}
                          <span
                            className={`font-medium ${
                              (component.state as SwitchState).isClosed
                                ? "text-green-600"
                                : "text-gray-500"
                            }`}
                          >
                            {(component.state as SwitchState).isClosed
                              ? "CLOSED"
                              : "OPEN"}
                          </span>
                        </p>
                        <button
                          onClick={() => toggleSwitch(component.id)}
                          className="w-full px-3 py-1.5 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100 transition-colors"
                        >
                          Toggle Switch
                        </button>
                      </>
                    )}
                    {component.type === "resistor" && (
                      <p>
                        <span className="text-gray-500">Resistance:</span>{" "}
                        <span className="font-medium">
                          {
                            (component.state as { resistance: number })
                              .resistance
                          }
                          Ω
                        </span>
                      </p>
                    )}
                    {component.type === "capacitor" && (
                      <p>
                        <span className="text-gray-500">Capacitance:</span>{" "}
                        <span className="font-medium">
                          {
                            (component.state as { capacitance: number })
                              .capacitance
                          }
                          µF
                        </span>
                      </p>
                    )}
                    {component.type === "buzzer" && (
                      <p>
                        <span className="text-gray-500">State:</span>{" "}
                        <span
                          className={`font-medium ${
                            (
                              simulation.componentStates.get(component.id) as
                                | BuzzerState
                                | undefined
                            )?.isActive
                              ? "text-yellow-600"
                              : "text-gray-500"
                          }`}
                        >
                          {(
                            simulation.componentStates.get(component.id) as
                              | BuzzerState
                              | undefined
                          )?.isActive
                            ? "BUZZING"
                            : "SILENT"}
                        </span>
                      </p>
                    )}
                    <button
                      onClick={() => {
                        useCircuitStore
                          .getState()
                          .removeComponent(selectedComponentId);
                      }}
                      className="mt-2 w-full px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 transition-colors"
                    >
                      Delete Component
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

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
