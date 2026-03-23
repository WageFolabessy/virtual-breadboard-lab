import { useRef, useCallback } from 'react';
import { setWireDrawingPosition } from '@/lib/store/circuit-store';

interface CanvasInteraction {
  svgRef: React.RefObject<SVGSVGElement | null>;
  handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleSvgClick: () => void;
}

/**
 * Encapsulates SVG canvas interaction logic:
 * - Tracks mouse position for the wire-drawing preview
 * - Handles background click to deselect components
 *
 * @param wireStartNodeId - non-null when the user is mid-wire-draw
 * @param onDeselect - callback to deselect the current component
 */
export function useCanvasInteraction(
  wireStartNodeId: string | null,
  onDeselect: () => void,
): CanvasInteraction {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || !wireStartNodeId) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Updates isolated wire drawing state (does NOT trigger React re-render)
      setWireDrawingPosition(x, y);
    },
    [wireStartNodeId],
  );

  const handleSvgClick = useCallback(() => {
    onDeselect();
  }, [onDeselect]);

  return { svgRef, handleMouseMove, handleSvgClick };
}
