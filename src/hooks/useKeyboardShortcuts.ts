"use client";

import { useEffect, useCallback } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { SHORTCUTS } from "@/lib/constants";

/**
 * Handles global keyboard shortcuts for tool switching.
 * Extracted from Toolbar to keep UI components logic-free.
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
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case SHORTCUTS.SELECT_TOOL.toLowerCase():
          setSelectedTool("select");
          break;
        case SHORTCUTS.WIRE_TOOL.toLowerCase():
          setSelectedTool("wire");
          break;
        case SHORTCUTS.DELETE_TOOL.toLowerCase():
          setSelectedTool("delete");
          break;
        case SHORTCUTS.ESCAPE.toLowerCase():
          setSelectedTool("select");
          useCircuitStore.getState().cancelWire();
          useCircuitStore.getState().cancelComponentPlacement();
          break;
        case SHORTCUTS.UNDO.toLowerCase():
          // Often used with Ctrl/Cmd, but we support bare key too or with mod based on prompt
          if (e.ctrlKey || e.metaKey || !e.ctrlKey) {
            useCircuitStore.getState().undo();
          }
          break;
        case SHORTCUTS.REDO.toLowerCase():
          if (e.ctrlKey || e.metaKey || !e.ctrlKey) {
            useCircuitStore.getState().redo();
          }
          break;
        case SHORTCUTS.SAVE.toLowerCase():
          // Prevent browser save if Ctrl+S is pressed
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Store autosaves via persist, just provide visual feedback
            alert("Circuit saved to Local Storage!");
          } else {
            alert("Circuit saved to Local Storage!");
          }
          break;
        case SHORTCUTS.CLEAR.toLowerCase():
          if (window.confirm("Are you sure you want to clear the entire breadboard?")) {
            useCircuitStore.getState().clearAll();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedTool]);
}
