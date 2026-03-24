"use client";

// ============================================
// BUZZER SVG COMPONENT
// Piezo buzzer that makes sound when active
// Dynamic leads stretch from body edge to pin positions
// ============================================

import React, { useEffect, useRef } from "react";
import { asBuzzerState } from "@/lib/types";
import { COLORS } from "@/lib/constants";
import { areComponentPropsEqual, BaseComponentProps } from "./componentMemo";

interface BuzzerProps extends BaseComponentProps {
  isActive: boolean;
}

export const Buzzer: React.FC<BuzzerProps> = React.memo(
  ({ component, nodes, isSelected, isActive, onClick }) => {
    const state = asBuzzerState(component.state);

    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);

    // Sound effect when active
    useEffect(() => {
      if (isActive && state) {
        // Create audio context on first activation
        if (!audioContextRef.current) {
          audioContextRef.current = new (
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext
          )();
        }

        const ctx = audioContextRef.current;

        // Create oscillator
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(state.frequency, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime); // Low volume

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();

        oscillatorRef.current = oscillator;
        gainNodeRef.current = gainNode;
      } else {
        // Stop sound
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
        }
      }

      return () => {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
        }
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
        }
      };
    }, [isActive, state]);

    if (!state) return null;

    const positivePin = component.pins.find((p) => p.pinType === "positive");
    const negativePin = component.pins.find((p) => p.pinType === "negative");

    const node1 = positivePin?.connectedNodeId
      ? nodes.get(positivePin.connectedNodeId)
      : null;
    const node2 = negativePin?.connectedNodeId
      ? nodes.get(negativePin.connectedNodeId)
      : null;

    if (!node1 || !node2) return null;

    const x1 = node1.canvasPosition.x;
    const y1 = node1.canvasPosition.y;
    const x2 = node2.canvasPosition.x;
    const y2 = node2.canvasPosition.y;

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    const radius = 12;

    return (
      <g
        transform={`translate(${centerX}, ${centerY}) rotate(${angle})`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ cursor: "pointer" }}
      >
        {/* Glow effect when active */}
        {isActive && (
          <circle
            cx={0}
            cy={0}
            r={radius + 4}
            fill="rgba(251, 191, 36, 0.3)"
            className="animate-pulse"
          />
        )}

        {isSelected && (
          <circle
            cx={0}
            cy={0}
            r={radius + 6}
            fill="none"
            stroke={COLORS.SELECTION_HIGHLIGHT}
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}

        {/* DYNAMIC Positive lead — stretches from body edge to pin position */}
        <line
          x1={-length / 2}
          y1={0}
          x2={-radius - 1}
          y2={0}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* DYNAMIC Negative lead — stretches from body edge to pin position */}
        <line
          x1={radius + 1}
          y1={0}
          x2={length / 2}
          y2={0}
          stroke={isActive ? COLORS.POWER_RAIL : "#888"}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Buzzer body */}
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill={isActive ? "#1F2937" : "#374151"}
          stroke="#111"
          strokeWidth={2}
        />

        {/* Sound hole */}
        <circle
          cx={0}
          cy={0}
          r={radius - 4}
          fill="none"
          stroke={isActive ? "#FCD34D" : "#4B5563"}
          strokeWidth={1}
        />

        {/* Sound waves when active */}
        {isActive && (
          <>
            <path
              d={`M ${radius + 2} -4 Q ${radius + 6} 0 ${radius + 2} 4`}
              fill="none"
              stroke="#FCD34D"
              strokeWidth={1.5}
              opacity={0.8}
            />
            <path
              d={`M ${radius + 5} -6 Q ${radius + 10} 0 ${radius + 5} 6`}
              fill="none"
              stroke="#FCD34D"
              strokeWidth={1.5}
              opacity={0.5}
            />
          </>
        )}

        {/* Polarity markers */}
        <text
          x={-radius - 6}
          y={-8}
          fill="#666"
          fontSize="8"
          fontWeight="bold"
          textAnchor="middle"
        >
          +
        </text>
      </g>
    );
  },
  areComponentPropsEqual<BuzzerProps>(["isActive"]),
);

Buzzer.displayName = "Buzzer";

export default Buzzer;
