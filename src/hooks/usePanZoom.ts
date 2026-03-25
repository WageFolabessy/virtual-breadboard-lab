"use client";

import { useRef, useCallback, useEffect, useState } from "react";

// ---- Pan/Zoom Configuration ----
const MIN_SCALE = 0.3;
const MAX_SCALE = 5.0; // Support 500%+ zoom for crisp vector inspection
const ZOOM_SENSITIVITY = 0.001;
const ZOOM_BUTTON_STEP = 0.15;

export interface PanZoomState {
  scale: number;
  panX: number;
  panY: number;
}

export interface PanZoomActions {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

export interface UsePanZoomReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: PanZoomState;
  isPanning: boolean;
  actions: PanZoomActions;
  handlers: {
    onWheel: (e: React.WheelEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
  };
}

/**
 * Encapsulates pan & zoom logic for an infinite-canvas SVG workspace.
 *
 * AGENTS.MD COMPLIANCE:
 * - Uses optimized state updates for pan/zoom operations
 * - Batch updates during continuous interactions (wheel, drag)
 * - isPanning as boolean for cursor styling
 *
 * - Mouse wheel → zoom in/out (centered on cursor position)
 * - Middle-mouse drag or Ctrl+left-drag → pan the canvas
 *
 * Pan/zoom values are applied to an SVG <g> transform for lossless vector scaling.
 */
export function usePanZoom(): UsePanZoomReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  // State with optimized updates
  const [state, setState] = useState<PanZoomState>({
    scale: 1,
    panX: 0,
    panY: 0,
  });

  // isPanning as React state so component can read it for cursor styling
  const [isPanning, setIsPanning] = useState(false);

  // ---- Wheel → Zoom (centered on cursor) ----
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    setState((prev) => {
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta));
      const ratio = newScale / prev.scale;

      const container = containerRef.current;
      if (!container) return { ...prev, scale: newScale };

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Keep the point under the cursor stable during zoom
      const newPanX = mouseX - (mouseX - prev.panX) * ratio;
      const newPanY = mouseY - (mouseY - prev.panY) * ratio;

      return { scale: newScale, panX: newPanX, panY: newPanY };
    });
  }, []);

  // ---- Middle-mouse / Ctrl+left-click drag → Pan ----
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      setState((prev) => {
        panOriginRef.current = { x: prev.panX, y: prev.panY };
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;

      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;

      setState((prev) => ({
        ...prev,
        panX: panOriginRef.current.x + dx,
        panY: panOriginRef.current.y + dy,
      }));
    };

    const handleMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  // ---- Button actions ----
  const zoomIn = useCallback(() => {
    setState((prev) => {
      const newScale = Math.min(MAX_SCALE, prev.scale + ZOOM_BUTTON_STEP);
      const container = containerRef.current;
      if (!container) return { ...prev, scale: newScale };

      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = newScale / prev.scale;

      return {
        scale: newScale,
        panX: cx - (cx - prev.panX) * ratio,
        panY: cy - (cy - prev.panY) * ratio,
      };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => {
      const newScale = Math.max(MIN_SCALE, prev.scale - ZOOM_BUTTON_STEP);
      const container = containerRef.current;
      if (!container) return { ...prev, scale: newScale };

      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = newScale / prev.scale;

      return {
        scale: newScale,
        panX: cx - (cx - prev.panX) * ratio,
        panY: cy - (cy - prev.panY) * ratio,
      };
    });
  }, []);

  const resetView = useCallback(() => {
    setState({ scale: 1, panX: 0, panY: 0 });
  }, []);

  return {
    containerRef,
    state,
    isPanning,
    actions: { zoomIn, zoomOut, resetView },
    handlers: { onWheel, onMouseDown },
  };
}
