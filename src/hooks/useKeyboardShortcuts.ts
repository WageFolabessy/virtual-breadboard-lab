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
 * - Ctrl/Cmd+C: Copy circuit to clipboard
 * - Ctrl/Cmd+V: Paste circuit from clipboard
 * - Ctrl/Cmd+Z: Undo
 * - Ctrl/Cmd+Y: Redo
 * - Ctrl/Cmd+S: Export circuit
 */
export function useKeyboardShortcuts() {
  const setSelectedTool = useCallback(
    (tool: Parameters<ReturnType<typeof useCircuitStore.getState>["setSelectedTool"]>[0]) => {
      useCircuitStore.getState().setSelectedTool(tool);
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Handle keys (case-insensitive)
      const key = e.key.toLowerCase();
      const isModifierPressed = e.ctrlKey || e.metaKey;

      // ---- Clipboard Shortcuts (Ctrl/Cmd+C and Ctrl/Cmd+V) ----
      // These MUST be checked before tool shortcuts to avoid conflicts
      
      // Copy circuit to clipboard (Ctrl/Cmd+C)
      if (key === SHORTCUTS.COPY.toLowerCase() && isModifierPressed) {
        e.preventDefault();
        const success = await useCircuitStore.getState().copyCircuitToClipboard();
        if (!success) {
          alert("Failed to copy circuit to clipboard.");
        }
        return;
      }
      
      // Paste circuit from clipboard (Ctrl/Cmd+V)
      if (key === SHORTCUTS.PASTE.toLowerCase() && isModifierPressed) {
        e.preventDefault();
        const success = await useCircuitStore.getState().pasteCircuitFromClipboard();
        if (!success) {
          alert("Invalid VBL JSON format. Paste failed.");
        }
        return;
      }

      // ---- Tool shortcuts (no modifier key) ----
      if (key === SHORTCUTS.SELECT_TOOL.toLowerCase() && !isModifierPressed) {
        e.preventDefault();
        setSelectedTool("select");
        return;
      }

      if (key === SHORTCUTS.WIRE_TOOL.toLowerCase() && !isModifierPressed) {
        e.preventDefault();
        setSelectedTool("wire");
        return;
      }

      if (key === SHORTCUTS.DELETE_TOOL.toLowerCase() && !isModifierPressed) {
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

      // Undo (Ctrl/Cmd+Z)
      if (key === SHORTCUTS.UNDO.toLowerCase() && isModifierPressed) {
        e.preventDefault();
        useCircuitStore.getState().undo();
        return;
      }

      // Redo (Ctrl/Cmd+Y)
      if (key === SHORTCUTS.REDO.toLowerCase() && isModifierPressed) {
        e.preventDefault();
        useCircuitStore.getState().redo();
        return;
      }

      // Save/Export (Ctrl/Cmd+S)
      if (key === SHORTCUTS.SAVE.toLowerCase() && isModifierPressed) {
        e.preventDefault();
        useCircuitStore.getState().exportCircuit();
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
