"use client";

// ============================================
// TOAST NOTIFICATION COMPONENT
// Non-blocking replacement for alert() calls
//
// Subscribes to systemMessage from Zustand store.
// Auto-dismisses after 3 seconds (handled by store).
// Manual dismiss via × button.
// ============================================

import React from "react";
import { useCircuitStore } from "@/lib/store/circuit-store";

export const Toast: React.FC = () => {
  const systemMessage = useCircuitStore((state) => state.systemMessage);
  const setSystemMessage = useCircuitStore((state) => state.setSystemMessage);

  if (!systemMessage) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-in-up"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 rounded-lg bg-red-600 px-4 py-3 text-white shadow-lg shadow-red-600/30">
        {/* Warning icon */}
        <svg
          className="mt-0.5 h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>

        <p className="text-sm font-medium leading-snug">{systemMessage}</p>

        {/* Dismiss button */}
        <button
          onClick={() => setSystemMessage(null)}
          className="ml-auto -mr-1 -mt-1 shrink-0 rounded-md p-1 hover:bg-red-700 transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
