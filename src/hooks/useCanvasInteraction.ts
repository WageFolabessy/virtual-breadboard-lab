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
 * Coordinate conversion: screen → SVG content space.
 * With SVG <g transform="translate(panX,panY) scale(scale)">, the conversion is:
 *   contentX = (screenX - panX) / scale
 *   contentY = (screenY - panY) / scale
 *
 * @param wireStartNodeId - non-null when the user is mid-wire-draw
 * @param onDeselect - callback to deselect the current component
 * @param scale - current zoom scale
 * @param panX - current pan X offset
 * @param panY - current pan Y offset
 */
export function useCanvasInteraction(
  wireStartNodeId: string | null,
  onDeselect: () => void,
  scale: number = 1,
  panX: number = 0,
  panY: number = 0,
): CanvasInteraction {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || !wireStartNodeId) return;

      const rect = svgRef.current.getBoundingClientRect();
      // Convert screen coordinates → SVG content coordinates
      // The SVG fills the container (no viewBox transform), so screen-relative
      // coords are SVG user-space coords. The <g> transform maps content space.
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const contentX = (screenX - panX) / scale;
      const contentY = (screenY - panY) / scale;

      setWireDrawingPosition(contentX, contentY);
    },
    [wireStartNodeId, scale, panX, panY],
  );

  const handleSvgClick = useCallback(() => {
    onDeselect();
  }, [onDeselect]);

  return { svgRef, handleMouseMove, handleSvgClick };
}
