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
import { usePanZoom } from "@/hooks/usePanZoom";

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
  const selectedWireId = useCircuitStore((state) => state.selectedWireId); // NEW
  const selectedTool = useCircuitStore((state) => state.selectedTool); // NEW

  // ---- Hooks ----
  const { isInitialized } = useHydration();
  const { selectComponent, removeWire, toggleSwitch, removeComponent } =
    useCircuitActions();
  const isComponentActive = useComponentActiveChecker(components, activeNodes);
  
  // NEW: Wire selection action
  const selectWire = (wireId: string | null) => {
    useCircuitStore.getState().selectWire(wireId);
  };
  const {
    containerRef: panZoomContainerRef,
    state: panZoomState,
    isPanning,
    actions: panZoomActions,
    handlers: panZoomHandlers,
  } = usePanZoom();
  const { svgRef, handleMouseMove, handleSvgClick } = useCanvasInteraction(
    wireStartNodeId,
    () => selectComponent(null),
    panZoomState.scale,
    panZoomState.panX,
    panZoomState.panY,
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

        {/* Main Canvas Area — infinite-canvas with pan/zoom */}
        <div
          ref={panZoomContainerRef}
          className="flex-1 relative overflow-hidden bg-gray-200"
          style={{ cursor: isPanning ? "grabbing" : "crosshair" }}
          onWheel={panZoomHandlers.onWheel}
          onMouseDown={panZoomHandlers.onMouseDown}
        >
          {/* SVG Canvas — fills container, zoom/pan via native <g> transform for crisp vectors */}
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onMouseMove={handleMouseMove}
            onClick={handleSvgClick}
            className="block"
            textRendering="geometricPrecision"
            shapeRendering="geometricPrecision"
          >
            {/* Master transform group — all content scales as lossless vectors */}
            <g
              transform={`translate(${panZoomState.panX}, ${panZoomState.panY}) scale(${panZoomState.scale})`}
            >
              <Breadboard />

              {/* Wires Layer */}
              <g className="wires-layer">
                {wires.map((wire) => {
                  const isActive =
                    activeNodes.has(wire.startNodeId) &&
                    activeNodes.has(wire.endNodeId);
                  const isSelected = selectedWireId === wire.id; // NEW

                  return (
                    <Wire
                      key={wire.id}
                      wire={wire}
                      nodes={nodes}
                      isActive={isActive}
                      isSelected={isSelected}
                      selectedTool={selectedTool}
                      onSelect={selectWire}
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
            </g>
          </svg>

          {/* Zoom Controls — floating panel bottom-right */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg px-2 py-1.5 select-none">
            <button
              onClick={panZoomActions.zoomOut}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-bold text-lg transition-colors"
              title="Zoom Out"
            >
              −
            </button>
            <span className="w-14 text-center text-xs font-mono text-gray-600 tabular-nums">
              {Math.round(panZoomState.scale * 100)}%
            </span>
            <button
              onClick={panZoomActions.zoomIn}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-bold text-lg transition-colors"
              title="Zoom In"
            >
              +
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
              onClick={panZoomActions.resetView}
              className="px-2 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 active:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
              title="Reset Zoom & Pan"
            >
              Reset
            </button>
          </div>

          {/* Canvas Info Bar — bottom-left */}
          <div className="absolute bottom-4 left-4 flex items-center gap-4 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg px-3 py-1.5 text-xs text-gray-500">
            <span>Components: {components.length}</span>
            <span>Wires: {wires.length}</span>
            <div className="w-px h-4 bg-gray-300" />
            <KbdShortcut shortcut="V" label="Select" />
            <KbdShortcut shortcut="W" label="Wire" />
            <KbdShortcut shortcut="D" label="Delete" />
            <KbdShortcut shortcut="ESC" label="Cancel" />
            <div className="w-px h-4 bg-gray-300" />
            <span className="text-gray-400">Scroll: Zoom | Ctrl+Drag: Pan</span>
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

          {/* Selected Wire Info */}
          {selectedWireId &&
            (() => {
              const wire = wires.find((w) => w.id === selectedWireId);
              if (!wire) return null;

              const startNode = nodes.get(wire.startNodeId);
              const endNode = nodes.get(wire.endNodeId);

              return (
                <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    Selected Wire
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-gray-500">Color:</span>{" "}
                      <span 
                        className="inline-block w-4 h-4 rounded border border-gray-300 align-middle ml-1"
                        style={{ backgroundColor: wire.color }}
                      />
                    </p>
                    <p>
                      <span className="text-gray-500">Start Node:</span>{" "}
                      <span className="font-mono text-xs">
                        {startNode?.id || 'Unknown'}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">End Node:</span>{" "}
                      <span className="font-mono text-xs">
                        {endNode?.id || 'Unknown'}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">ID:</span>{" "}
                      <span className="font-mono text-xs">
                        {wire.id.slice(0, 8)}...
                      </span>
                    </p>
                    <button
                      onClick={() => removeWire(selectedWireId)}
                      className="mt-2 w-full px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 transition-colors"
                    >
                      Delete Wire
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
