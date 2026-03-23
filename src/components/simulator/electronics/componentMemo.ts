import { CircuitComponent, BreadboardNode } from '@/lib/types';

/**
 * Shared props shape for all electronics components.
 * Extends this interface in individual component prop types.
 */
export interface BaseComponentProps {
  component: CircuitComponent;
  nodes: Map<string, BreadboardNode>;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Resolves the canvas positions of a component's connected nodes.
 * Returns a stable string key that only changes when actual positions change.
 */
function getNodePositionKey(
  component: CircuitComponent,
  nodes: Map<string, BreadboardNode>,
): string {
  return component.pins
    .map((pin) => {
      if (!pin.connectedNodeId) return 'null';
      const node = nodes.get(pin.connectedNodeId);
      if (!node) return 'missing';
      return `${node.canvasPosition.x},${node.canvasPosition.y}`;
    })
    .join('|');
}

/**
 * Custom React.memo comparator for electronics components.
 *
 * The `nodes` Map gets a new reference on every store update,
 * but a component only cares about the positions of the specific
 * nodes its pins connect to. This comparator avoids re-rendering
 * when unrelated nodes change.
 *
 * For components with extra props (isActive, isLit, onToggle, etc.),
 * pass their keys as `extraKeys` to include them in the comparison.
 */
export function areComponentPropsEqual<T extends BaseComponentProps>(
  extraKeys: (keyof T)[] = [],
) {
  return (prev: T, next: T): boolean => {
    // Fast path: same object reference
    if (prev === next) return true;

    // Compare stable primitives
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.onClick !== next.onClick) return false;

    // Compare component identity and state
    if (prev.component !== next.component) return false;

    // Compare only the relevant node positions (not entire Map)
    if (
      getNodePositionKey(prev.component, prev.nodes) !==
      getNodePositionKey(next.component, next.nodes)
    ) {
      return false;
    }

    // Compare extra keys (isActive, isLit, onToggle, etc.)
    for (const key of extraKeys) {
      if (prev[key] !== next[key]) return false;
    }

    return true;
  };
}
