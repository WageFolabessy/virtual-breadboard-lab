"use client";

// ============================================
// ONBOARDING TOUR COMPONENT
// Interactive step-by-step guide for first-time users
// ============================================
//
// AGENTS.md COMPLIANCE:
// - Tour state managed via circuit-store (global state)
// - Component is "dumb" rendering wrapper for react-joyride
// - Uses stable store action references (getState().action)
// ============================================

import React, { useEffect, useCallback } from "react";
import { Joyride } from "react-joyride";
import type { Step, Status } from "react-joyride";
import { useCircuitStore } from "@/lib/store/circuit-store";
import { STORAGE_KEYS } from "@/lib/constants";

// ---- Tour Step Definitions ----
const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="component-library"]',
    content: (
      <div>
        <h3 className="text-lg font-bold mb-2">Welcome to Virtual Breadboard Lab!</h3>
        <p className="text-sm">
          Let&apos;s learn how to build your first circuit. Start by selecting a component from this sidebar.
          <strong> Try clicking on a Battery!</strong>
        </p>
      </div>
    ),
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-tour="breadboard"]',
    content: (
      <div>
        <h3 className="text-lg font-bold mb-2">Place Your Component</h3>
        <p className="text-sm">
          Click on the breadboard to place your selected component. Each hole represents a connection point.
          <strong> Click two adjacent holes to place a 2-pin component like a Battery.</strong>
        </p>
      </div>
    ),
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-tour="wire-tool"]',
    content: (
      <div>
        <h3 className="text-lg font-bold mb-2">Connect with Wires</h3>
        <p className="text-sm">
          Use the <strong>Wire tool (W)</strong> to connect components together.
          Click on one hole, then click on another to create a wire connection.
        </p>
      </div>
    ),
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: '[data-tour="circuit-info"]',
    content: (
      <div>
        <h3 className="text-lg font-bold mb-2">Monitor Your Circuit</h3>
        <p className="text-sm">
          Check your circuit status here. <strong className="text-green-600">Green = Working!</strong>{" "}
          <strong className="text-red-600">Red = Short Circuit!</strong> The simulator evaluates your circuit in real-time.
        </p>
      </div>
    ),
    placement: "left",
    skipBeacon: true,
  },
];

// ---- Custom Joyride Styles (FIX: z-index and overlay color) ----
const joyrideStyles = {
  options: {
    zIndex: 10000,
    overlayColor: "rgba(0, 0, 0, 0.6)",
    arrowColor: "#fff",
    backgroundColor: "#fff",
    primaryColor: "#3B82F6", // Tailwind blue-500
    textColor: "#1F2937", // Tailwind gray-800
  },
  tooltip: {
    borderRadius: 8,
    padding: 16,
  },
  tooltipContainer: {
    textAlign: "left" as const,
  },
  buttonNext: {
    backgroundColor: "#3B82F6",
    borderRadius: 6,
    color: "#fff",
    padding: "8px 16px",
  },
  buttonBack: {
    color: "#6B7280", // Tailwind gray-500
    marginRight: 8,
  },
  buttonSkip: {
    color: "#9CA3AF", // Tailwind gray-400
  },
};

export const OnboardingTour: React.FC = () => {
  // Subscribe to tour running state from store
  const isTourRunning = useCircuitStore((state) => state.isTourRunning);

  // Auto-start tour for first-time users (check localStorage on mount)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Defer to avoid cascading renders
    const timeoutId = setTimeout(() => {
      try {
        const hasSeenTour = localStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN);
        if (!hasSeenTour) {
          // First-time user: auto-start tour
          useCircuitStore.getState().startTour();
        }
      } catch (e) {
        console.warn("[VBL] Failed to read onboarding state:", e);
      }
    }, 1000); // 1 second delay for UI to settle

    return () => clearTimeout(timeoutId);
  }, []);

  // Handle Joyride events (finished, skipped, etc.)
  const handleJoyrideCallback = useCallback((data: { status: Status; type: string }) => {
    const { status, type } = data;

    // Check for tour completion or skip
    if (status === "finished" || status === "skipped") {
      // Stop the tour
      useCircuitStore.getState().stopTour();

      // Mark as seen in localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, "true");
      } catch (e) {
        console.warn("[VBL] Failed to save onboarding state:", e);
      }
    }

    // Log for debugging (can remove in production)
    if (type === "step:after") {
      console.debug("[VBL] Tour step completed:", data);
    }
  }, []);

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={isTourRunning}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideCallback}
      styles={joyrideStyles}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
};

export default OnboardingTour;
