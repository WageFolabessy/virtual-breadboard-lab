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
        case SHORTCUTS.SELECT_TOOL:
          setSelectedTool("select");
          break;
        case SHORTCUTS.WIRE_TOOL:
          setSelectedTool("wire");
          break;
        case SHORTCUTS.DELETE_TOOL:
          setSelectedTool("delete");
          break;
        case SHORTCUTS.ESCAPE:
          setSelectedTool("select");
          useCircuitStore.getState().cancelWire();
          useCircuitStore.getState().cancelComponentPlacement();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedTool]);
}
