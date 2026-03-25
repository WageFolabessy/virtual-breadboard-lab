"use client";

import { useEffect, useCallback } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { SHORTCUTS } from "@/lib/constants";

/**
 * Handles global keyboard shortcuts for tool switching and actions.
 * Extracted from Toolbar to keep UI components logic-free.
 * 
 * SHORTCUTS:
 * - V: Select tool
 * - W: Wire tool
 * - D: Delete tool
 * - Escape: Clear all selections, cancel wire/placement, return to select tool
 * - Delete/Backspace: Delete currently selected component or wire
 */
export function useKeyboardShortcuts() {
  const setSelectedTool = useCallback(
    (tool: Parameters<ReturnType<typeof useCircuitStore.getState>["setSelectedTool"]>[0]) => {
      useCircuitStore.getState().setSelectedTool(tool);
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Handle keys (case-insensitive)
      const key = e.key.toLowerCase();

      // Tool shortcuts
      if (key === SHORTCUTS.SELECT_TOOL.toLowerCase()) {
        e.preventDefault();
        setSelectedTool("select");
        return;
      }

      if (key === SHORTCUTS.WIRE_TOOL.toLowerCase()) {
        e.preventDefault();
        setSelectedTool("wire");
        return;
      }

      if (key === SHORTCUTS.DELETE_TOOL.toLowerCase()) {
        e.preventDefault();
        setSelectedTool("delete");
        return;
      }

      // Escape: Clear all selections and cancel active operations
      if (key === SHORTCUTS.ESCAPE.toLowerCase() || key === 'escape') {
        e.preventDefault();
        const store = useCircuitStore.getState();
        
        // Cancel wire drawing
        store.cancelWire();
        
        // Cancel component placement
        store.cancelComponentPlacement();
        
        // Clear selections (mutual exclusivity)
        store.selectComponent(null);
        store.selectWire(null);
        
        // Return to select tool
        setSelectedTool("select");
        return;
      }

      // Delete/Backspace: Delete currently selected component or wire
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        useCircuitStore.getState().deleteSelected();
        return;
      }

      // Undo (Ctrl/Cmd+Z or just Z)
      if (key === SHORTCUTS.UNDO.toLowerCase()) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          useCircuitStore.getState().undo();
        }
        return;
      }

      // Redo (Ctrl/Cmd+Y or just Y)
      if (key === SHORTCUTS.REDO.toLowerCase()) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          useCircuitStore.getState().redo();
        }
        return;
      }

      // Save/Export (Ctrl/Cmd+S)
      if (key === SHORTCUTS.SAVE.toLowerCase()) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          useCircuitStore.getState().exportCircuit();
        }
        return;
      }

      // Clear all (Delete key when nothing selected)
      if (key === SHORTCUTS.CLEAR.toLowerCase()) {
        const state = useCircuitStore.getState();
        // Only trigger full clear if nothing is selected
        if (!state.selectedComponentId && !state.selectedWireId) {
          if (window.confirm("Are you sure you want to clear the entire breadboard?")) {
            state.clearAll();
          }
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedTool]);
}
