import { useState, useEffect } from 'react';

/**
 * Manages Zustand persist hydration gate.
 * Returns `isInitialized` which is false during SSR/hydration
 * and becomes true after a microtask tick on mount.
 */
export function useHydration(): { isInitialized: boolean } {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Zustand persist handles hydration automatically.
    // Defer initialization by one tick to avoid hydration mismatch.
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return { isInitialized };
}
