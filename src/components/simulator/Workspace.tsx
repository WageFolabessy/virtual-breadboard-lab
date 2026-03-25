"use client";

// ============================================
// WORKSPACE COMPONENT
// Main client component that composes the simulator
// ============================================
//
// AGENTS.md COMPLIANCE:
// 1. Wire preview uses isolated ref-based state (no React re-renders)
// 2. Circuit evaluation ONLY runs on finalized actions (mouseUp)
// 3. Memoized selectors prevent cascade re-renders
// 4. All logic extracted into dedicated hooks — this component is pure rendering
// 5. Info panels extracted to separate "dumb" components
// 6. Component rendering uses registry pattern (no hardcoded type checks)
// ============================================

import React, { useSyncExternalStore, useMemo } from "react";
import {
  useCircuitStore,
  getWireDrawingState,
  subscribeToWireDrawing,
} from "@/lib/store/circuit-store";
import { useShallow } from "zustand/react/shallow";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { KbdShortcut } from "@/components/ui/KbdShortcut";
import { FloatingPanel, IconButton } from "@/components/ui";
import { Breadboard } from "./Breadboard";
import { Toolbar } from "./Toolbar";
import { ComponentLibrary } from "./ComponentLibrary";
import { Wire, WirePreview } from "./Wire";
import { renderComponent } from "./ComponentRegistry";
import { ComponentInfoPanel, WireInfoPanel } from "./panels";
import { Header } from "@/components/Header";
import { useHydration } from "@/hooks/useHydration";
import {
  useCircuitActions,
  useComponentActiveChecker,
} from "@/hooks/useCircuitActions";
import { useCanvasInteraction } from "@/hooks/useCanvasInteraction";
import { usePanZoom } from "@/hooks/usePanZoom";
import { useSimulationTicker } from "@/hooks/useSimulationTicker";

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
  const selectedWireId = useCircuitStore((state) => state.selectedWireId);
  const selectedTool = useCircuitStore((state) => state.selectedTool);

  // ---- Memoized derived state ----
  // Find selected component/wire ONCE per render (not in JSX)
  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedComponentId) ?? null,
    [components, selectedComponentId],
  );
  const selectedWire = useMemo(
    () => wires.find((w) => w.id === selectedWireId) ?? null,
    [wires, selectedWireId],
  );

  // ---- Hooks ----
  const { isInitialized } = useHydration();
  const {
    selectComponent,
    removeWire,
    toggleSwitch,
    removeComponent,
    selectWire,
  } = useCircuitActions();
  const isComponentActive = useComponentActiveChecker(components, activeNodes);
  useSimulationTicker(); // Advances 555 Timer clock every 500ms

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

      {/* Main Content Area - Mobile: stacked, Desktop: 3-column */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <ComponentLibrary />

        {/* Main Canvas Area — infinite-canvas with pan/zoom */}
        <div
          ref={panZoomContainerRef}
          className="flex-1 relative overflow-hidden bg-gray-200 min-h-[50vh] lg:min-h-0"
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

              {/* Layer 2: Components (rendered via registry - no hardcoded type checks) */}
              <g className="components-layer">
                {components.map((component) => {
                  const isSelected = selectedComponentId === component.id;
                  const isActive = isComponentActive(component.id);
                  const simulationState = simulation.componentStates.get(component.id);

                  return renderComponent({
                    component,
                    nodes,
                    isSelected,
                    isActive,
                    simulationState,
                    onSelect: () => selectComponent(component.id),
                    onToggle: () => toggleSwitch(component.id),
                  });
                })}
              </g>

              {/* Layer 3: Wires (rendered last = visually on top of components) */}
              <g className="wires-layer">
                {wires.map((wire) => {
                  const isActive =
                    activeNodes.has(wire.startNodeId) &&
                    activeNodes.has(wire.endNodeId);
                  const isSelected = selectedWireId === wire.id;

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
            </g>
          </svg>

          {/* Zoom Controls — floating panel bottom-right */}
          <FloatingPanel position="bottom-right">
            <IconButton onClick={panZoomActions.zoomOut} title="Zoom Out">
              −
            </IconButton>
            <span className="w-14 text-center text-xs font-mono text-gray-600 tabular-nums">
              {Math.round(panZoomState.scale * 100)}%
            </span>
            <IconButton onClick={panZoomActions.zoomIn} title="Zoom In">
              +
            </IconButton>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
              onClick={panZoomActions.resetView}
              className="px-3 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 active:bg-gray-200 text-gray-600 text-xs font-medium transition-colors cursor-pointer"
              title="Reset Zoom & Pan"
            >
              Reset
            </button>
          </FloatingPanel>

          {/* Canvas Info Bar — bottom-left */}
          <FloatingPanel position="bottom-left" className="gap-4 px-3">
            <span>Components: {components.length}</span>
            <span>Wires: {wires.length}</span>
            <div className="w-px h-4 bg-gray-300" />
            <KbdShortcut shortcut="V" label="Select" />
            <KbdShortcut shortcut="W" label="Wire" />
            <KbdShortcut shortcut="D" label="Delete" />
            <KbdShortcut shortcut="ESC" label="Cancel" />
            <div className="w-px h-4 bg-gray-300" />
            <span className="text-gray-400">Scroll: Zoom | Ctrl+Drag: Pan</span>
          </FloatingPanel>
        </div>

        {/* Right Panel - Info/Properties - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:block w-64 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Circuit Info</h2>

          <StatusIndicator
            status={simulation.status}
            message={simulation.message}
          />

          {/* Selected Component Info - Using extracted panel component */}
          {selectedComponent && (
            <ComponentInfoPanel
              component={selectedComponent}
              simulation={simulation}
              onToggleSwitch={toggleSwitch}
              onDelete={removeComponent}
            />
          )}

          {/* Selected Wire Info - Using extracted panel component */}
          {selectedWire && (
            <WireInfoPanel
              wire={selectedWire}
              nodes={nodes}
              onDelete={removeWire}
            />
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
