"use client";

import { useEffect } from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";

/**
 * Simulation Ticker — The Beating Heart
 * 
 * Runs a background interval that advances time-based components (e.g., 555 Timer).
 * Each tick toggles the clock state of powered 555 ICs and re-evaluates the circuit.
 * 
 * Mount this ONCE at the Workspace level. The interval is properly cleaned up on unmount.
 */
const TICK_INTERVAL_MS = 500;

export function useSimulationTicker() {
  useEffect(() => {
    const interval = setInterval(() => {
      // Only tick if there are any 555 ICs on the board
      const state = useCircuitStore.getState();
      const has555 = state.components.some(c => c.type === 'ic_555');
      if (has555) {
        state.tick();
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
