import { useRef, useCallback, useEffect } from 'react';
import { setWireDrawingPosition, setComponentDragPosition } from '@/lib/store/circuit-store';

interface CanvasInteraction {
  svgRef: React.RefObject<SVGSVGElement | null>;
  handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleSvgClick: () => void;
}

/**
 * Encapsulates SVG canvas interaction logic:
 * - Tracks mouse position for wire-drawing preview (new wire or endpoint relocation)
 * - Tracks mouse delta for component drag
 * - Handles background click to deselect components
 *
 * Coordinate conversion: screen → SVG content space.
 * With SVG <g transform="translate(panX,panY) scale(scale)">, the conversion is:
 *   contentX = (screenX - panX) / scale
 *   contentY = (screenY - panY) / scale
 */
export function useCanvasInteraction(
  wireStartNodeId: string | null,
  movingWireId: string | null,
  movingComponentId: string | null,
  onDeselect: () => void,
  scale: number = 1,
  panX: number = 0,
  panY: number = 0,
): CanvasInteraction {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Track initial mouse position when component drag starts
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Active when drawing/moving a wire OR dragging a component
  const isWireTracking = wireStartNodeId !== null || movingWireId !== null;
  const isComponentDragging = movingComponentId !== null;

  // Reset drag start ref when component drag ends (must be in effect, not render)
  useEffect(() => {
    if (!isComponentDragging) {
      dragStartRef.current = null;
    }
  }, [isComponentDragging]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      if (!isWireTracking && !isComponentDragging) return;

      const rect = svgRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const contentX = (screenX - panX) / scale;
      const contentY = (screenY - panY) / scale;

      if (isWireTracking) {
        setWireDrawingPosition(contentX, contentY);
      }

      if (isComponentDragging) {
        if (!dragStartRef.current) {
          dragStartRef.current = { x: contentX, y: contentY };
        }
        const deltaX = contentX - dragStartRef.current.x;
        const deltaY = contentY - dragStartRef.current.y;
        setComponentDragPosition(deltaX, deltaY);
      }
    },
    [isWireTracking, isComponentDragging, scale, panX, panY],
  );

  const handleSvgClick = useCallback(() => {
    onDeselect();
  }, [onDeselect]);

  return { svgRef, handleMouseMove, handleSvgClick };
}
