import { useCallback } from 'react';
import { useCircuitStore } from '@/lib/store/circuit-store';
import { CircuitComponent } from '@/lib/types';

/**
 * Provides stable, memoized action callbacks that access the store
 * via `getState()` to prevent dependency cycles and re-renders.
 */
export function useCircuitActions() {
  const selectComponent = useCallback((id: string | null) => {
    useCircuitStore.getState().selectComponent(id);
  }, []);

  const removeWire = useCallback((wireId: string) => {
    useCircuitStore.getState().removeWire(wireId);
  }, []);

  const toggleSwitch = useCallback((componentId: string) => {
    useCircuitStore.getState().toggleSwitch(componentId);
  }, []);

  const removeComponent = useCallback((componentId: string) => {
    useCircuitStore.getState().removeComponent(componentId);
  }, []);

  const selectWire = useCallback((wireId: string | null) => {
    useCircuitStore.getState().selectWire(wireId);
  }, []);

  const cancelComponentPlacement = useCallback(() => {
    useCircuitStore.getState().cancelComponentPlacement();
  }, []);

  const setButtonPressed = useCallback((componentId: string, pressed: boolean) => {
    useCircuitStore.getState().setButtonPressed(componentId, pressed);
  }, []);

  const startMoveWireEndpoint = useCallback((wireId: string, endpoint: 'start' | 'end') => {
    useCircuitStore.getState().startMoveWireEndpoint(wireId, endpoint);
  }, []);

  return { selectComponent, removeWire, toggleSwitch, removeComponent, selectWire, cancelComponentPlacement, setButtonPressed, startMoveWireEndpoint };
}

/**
 * Returns a memoized checker that determines whether a component
 * is fully within the active circuit path.
 *
 * Both `components` and `activeNodes` are passed as parameters so
 * the callback is re-created only when those dependencies change.
 */
export function useComponentActiveChecker(
  components: CircuitComponent[],
  activeNodes: Set<string>,
) {
  return useCallback(
    (componentId: string): boolean => {
      const component = components.find((c) => c.id === componentId);
      if (!component) return false;

      const connectedPins = component.pins.filter(
        (p) => p.connectedNodeId !== null,
      );
      return connectedPins.every((pin) =>
        activeNodes.has(pin.connectedNodeId!),
      );
    },
    [components, activeNodes],
  );
}
