"use client";

// ============================================
// UI SOUNDS HOOK
// Handles WebAudio API logic for UI feedback sounds
// Extracted per AGENTS.md: "Brains are Hooks"
// ============================================
//
// AUDIO ARCHITECTURE:
// - Singleton AudioContext (lazy init on first call)
// - Respects browser autoplay policies (init on user interaction)
// - Mathematically synthesized sounds (no external files)
// - Short, snappy envelopes for instant feedback
// ============================================

import { useRef, useCallback } from "react";

/**
 * Custom hook to provide UI sound effects using Web Audio API.
 * Separates audio business logic from visual components.
 * 
 * Returns stable callback refs that can be safely used in store actions.
 */
export function useUISounds() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Initialize AudioContext lazily (only on first sound trigger).
   * This respects browser autoplay policies by ensuring initialization
   * happens within a user interaction context.
   */
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current && typeof window !== "undefined") {
      try {
        audioContextRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
        isInitializedRef.current = true;
      } catch (e) {
        console.warn("[VBL] Web Audio API not supported:", e);
      }
    }
    return audioContextRef.current;
  }, []);

  /**
   * Play a sharp "click" sound (wire placement, button clicks).
   * Sine wave, 800Hz, 50ms decay.
   */
  const playClick = useCallback(() => {
    const ctx = initAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);

    // Envelope: Quick attack, fast decay
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  }, [initAudioContext]);

  /**
   * Play a soft "snap" sound (component placement).
   * Triangle wave, 300Hz, 80ms decay.
   */
  const playSnap = useCallback(() => {
    const ctx = initAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);

    // Envelope: Softer, slightly longer decay
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
  }, [initAudioContext]);

  /**
   * Play a downward sweep sound (delete action).
   * Sawtooth wave, 600Hz → 200Hz, 100ms.
   */
  const playDelete = useCallback(() => {
    const ctx = initAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);

    // Envelope: Sharp attack, quick fade
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }, [initAudioContext]);

  return {
    playClick,
    playSnap,
    playDelete,
  };
}

/**
 * Singleton instance for global sound system.
 * This allows circuit-store.ts to trigger sounds without React context.
 */
class GlobalSoundSystem {
  private audioContext: AudioContext | null = null;

  private initAudioContext(): AudioContext | null {
    if (!this.audioContext && typeof window !== "undefined") {
      try {
        this.audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
      } catch (e) {
        console.warn("[VBL] Web Audio API not supported:", e);
      }
    }
    return this.audioContext;
  }

  playClick(): void {
    const ctx = this.initAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  }

  playSnap(): void {
    const ctx = this.initAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
  }

  playDelete(): void {
    const ctx = this.initAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }
}

export const globalSoundSystem = new GlobalSoundSystem();
