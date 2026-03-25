"use client";

// ============================================
// BUZZER SOUND HOOK
// Handles WebAudio API logic for buzzer component
// Extracted per AGENTS.md: "Brains are Hooks"
// ============================================

import { useEffect, useRef } from "react";

/**
 * Custom hook to manage buzzer sound using WebAudio API.
 * Separates audio business logic from the visual Buzzer component.
 *
 * @param isActive - Whether the buzzer should be making sound
 * @param frequency - Sound frequency in Hz (default 440)
 */
export function useBuzzerSound(isActive: boolean, frequency: number = 440): void {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (isActive) {
      // Create audio context on first activation (lazy initialization)
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
      }

      const ctx = audioContextRef.current;

      // Create oscillator and gain node
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Configure oscillator
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      // Configure gain (low volume to avoid being too loud)
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);

      // Connect audio graph: oscillator -> gain -> destination
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();

      // Store references for cleanup
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
    } else {
      // Stop sound when deactivated
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

    // Cleanup on unmount or dependency change
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
    };
  }, [isActive, frequency]);
}
