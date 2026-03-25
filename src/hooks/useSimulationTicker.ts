"use client";

import { useEffect } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { COMPONENT_DEFINITIONS } from "@/lib/constants";

/**
 * Simulation Ticker — The Beating Heart
 * 
 * Runs a background interval that advances time-based components (e.g., 555 Timer).
 * Each tick toggles the clock state of powered timed components and re-evaluates the circuit.
 * 
 * AGENTS.md Compliance:
 * - TRAIT-DRIVEN: Uses `isTimed` trait instead of hardcoded type check
 * 
 * Mount this ONCE at the Workspace level. The interval is properly cleaned up on unmount.
 */
const TICK_INTERVAL_MS = 500;

export function useSimulationTicker() {
  useEffect(() => {
    const interval = setInterval(() => {
      // TRAIT-DRIVEN: Only tick if there are any timed components on the board
      const state = useCircuitStore.getState();
      const hasTimedComponent = state.components.some(c => {
        const def = COMPONENT_DEFINITIONS[c.type];
        return def?.isTimed === true;
      });
      
      if (hasTimedComponent) {
        state.tick();
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
