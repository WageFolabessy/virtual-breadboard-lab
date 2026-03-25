"use client";

// ============================================
// useBreadboardNode HOOK
// Encapsulates color determination and DOM-based hover handlers for breadboard nodes
//
// AGENTS.md Compliance:
// - Separation of Concerns: Logic extracted from BreadboardNodeComponent UI
// - Render Optimization: Handlers wrapped in useCallback with correct dependencies
// - DOM Manipulation: Hover effects use native DOM (no React re-renders)
//
// CRITICAL: These callbacks must have stable references for React.memo to work!
// Any change in callback identity will cause ALL 300+ nodes to re-render.
// ============================================

import { useCallback, RefObject } from "react";
import { BreadboardNode } from "@/lib/types";
import { COLORS } from "@/lib/constants";

// ---- Constants for hole appearance ----
const HOLE_SIZE = 6;
const HOLE_HOVER_SIZE = 8;

interface UseBreadboardNodeProps {
  node: BreadboardNode;
  isWireStart: boolean;
  isPlacementTarget: boolean;
  isPositive: boolean;
  isNegative: boolean;
  rectRef: RefObject<SVGRectElement | null>;
  glowRef: RefObject<SVGRectElement | null>;
}

interface UseBreadboardNodeReturn {
  baseFill: string;
  glowColor: string | null;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
}

export function useBreadboardNode({
  node,
  isWireStart,
  isPlacementTarget,
  isPositive,
  isNegative,
  rectRef,
  glowRef,
}: UseBreadboardNodeProps): UseBreadboardNodeReturn {
  // ---- Memoized base fill color based on state priority ----
  const getBaseFillColor = useCallback((): string => {
    if (node.isOccupied) return COLORS.NODE_OCCUPIED;
    if (isWireStart) return COLORS.SELECTION_HIGHLIGHT;
    if (isPlacementTarget) return COLORS.PALETTE_GREEN;
    return COLORS.NODE_EMPTY;
  }, [node.isOccupied, isWireStart, isPlacementTarget]);

  // ---- Memoized glow color for voltage potential ----
  const getGlowColor = useCallback((): string | null => {
    if (node.isOccupied || isWireStart || isPlacementTarget) {
      return null; // No glow when in special states
    }
    if (isPositive && isNegative) return "rgba(168, 85, 247, 0.7)"; // Purple blend
    if (isPositive) return COLORS.POSITIVE_POTENTIAL;
    if (isNegative) return COLORS.NEGATIVE_POTENTIAL;
    return null;
  }, [node.isOccupied, isWireStart, isPlacementTarget, isPositive, isNegative]);

  // ---- DOM-based hover enter (no React re-render) ----
  const handleMouseEnter = useCallback(() => {
    if (rectRef.current) {
      const newSize = HOLE_HOVER_SIZE;
      const offset = (newSize - HOLE_SIZE) / 2;
      rectRef.current.setAttribute(
        "x",
        String(node.canvasPosition.x - HOLE_SIZE / 2 - offset)
      );
      rectRef.current.setAttribute(
        "y",
        String(node.canvasPosition.y - HOLE_SIZE / 2 - offset)
      );
      rectRef.current.setAttribute("width", String(newSize));
      rectRef.current.setAttribute("height", String(newSize));
      rectRef.current.setAttribute("stroke", "#fff");
      rectRef.current.setAttribute("stroke-width", "1");

      // Update fill for hover if not in a special state
      if (
        !node.isOccupied &&
        !isWireStart &&
        !isPlacementTarget &&
        !isPositive &&
        !isNegative
      ) {
        rectRef.current.setAttribute("fill", COLORS.NODE_HOVER);
      }
    }
    if (glowRef.current) {
      const newSize = HOLE_HOVER_SIZE + 4;
      const offset = (newSize - HOLE_SIZE - 4) / 2;
      glowRef.current.setAttribute(
        "x",
        String(node.canvasPosition.x - HOLE_SIZE / 2 - 2 - offset)
      );
      glowRef.current.setAttribute(
        "y",
        String(node.canvasPosition.y - HOLE_SIZE / 2 - 2 - offset)
      );
      glowRef.current.setAttribute("width", String(newSize));
      glowRef.current.setAttribute("height", String(newSize));
    }
  }, [
    node.canvasPosition.x,
    node.canvasPosition.y,
    node.isOccupied,
    isWireStart,
    isPlacementTarget,
    isPositive,
    isNegative,
    rectRef,
    glowRef,
  ]);

  // ---- DOM-based hover leave (no React re-render) ----
  const handleMouseLeave = useCallback(() => {
    if (rectRef.current) {
      rectRef.current.setAttribute(
        "x",
        String(node.canvasPosition.x - HOLE_SIZE / 2)
      );
      rectRef.current.setAttribute(
        "y",
        String(node.canvasPosition.y - HOLE_SIZE / 2)
      );
      rectRef.current.setAttribute("width", String(HOLE_SIZE));
      rectRef.current.setAttribute("height", String(HOLE_SIZE));
      rectRef.current.setAttribute("stroke", COLORS.NODE_INNER_SHADOW);
      rectRef.current.setAttribute("stroke-width", "0.5");
      rectRef.current.setAttribute("fill", getBaseFillColor());
    }
    if (glowRef.current) {
      glowRef.current.setAttribute(
        "x",
        String(node.canvasPosition.x - HOLE_SIZE / 2 - 2)
      );
      glowRef.current.setAttribute(
        "y",
        String(node.canvasPosition.y - HOLE_SIZE / 2 - 2)
      );
      glowRef.current.setAttribute("width", String(HOLE_SIZE + 4));
      glowRef.current.setAttribute("height", String(HOLE_SIZE + 4));
    }
  }, [node.canvasPosition.x, node.canvasPosition.y, getBaseFillColor, rectRef, glowRef]);

  return {
    baseFill: getBaseFillColor(),
    glowColor: getGlowColor(),
    handleMouseEnter,
    handleMouseLeave,
  };
}
