'use client';

import { useCallback, useRef } from 'react';

type OscillatorType = 'sine' | 'square' | 'triangle' | 'sawtooth';

/**
 * Web Audio API sound synthesis for the draw experience.
 * All sounds are generated at runtime — no audio files needed.
 */
export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  /**
   * Single tick sound — short click used during reel spin.
   */
  const playTick = useCallback(
    (pitch = 800, volume = 0.15) => {
      const ctx = getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    },
    [getContext]
  );

  /**
   * Drumroll — sustained tremolo oscillator.
   * Returns a stop function.
   */
  /**
   * Drumroll — sustained tremolo oscillator with configurable duration.
   * Returns a stop function.
   */
  const playDrumroll = useCallback(
    (duration = 10) => {
      const ctx = getContext();
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const mainGain = ctx.createGain();

      // Main oscillator: low rumble
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, ctx.currentTime);

      // LFO for tremolo effect
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(18, ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.28, ctx.currentTime);

      mainGain.gain.setValueAtTime(0.18, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(mainGain.gain);
      osc.connect(mainGain);
      mainGain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      lfo.start(ctx.currentTime);

      // Ramp up intensity over the full countdown duration
      lfo.frequency.linearRampToValueAtTime(38, ctx.currentTime + duration);
      mainGain.gain.linearRampToValueAtTime(0.36, ctx.currentTime + duration);

      return () => {
        try {
          mainGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.3);
          lfo.stop(ctx.currentTime + 0.3);
        } catch {
          // Already stopped
        }
      };
    },
    [getContext]
  );

  /**
   * Triumphant chime — harmonics-based bell tone.
   */
  const playChime = useCallback(() => {
    const ctx = getContext();
    const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const durations = [2, 1.8, 1.5, 2.5];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = (i === 3 ? 'sine' : 'triangle') as OscillatorType;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const startTime = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + durations[i]);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + durations[i]);
    });
  }, [getContext]);

  /**
   * Suspenseful whoosh — for the deceleration phase.
   */
  const playWhoosh = useCallback(() => {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  }, [getContext]);

  /**
   * High-impact countdown beep starting from 10 down to 1.
   * Pitch and urgency increase dramatically on 3, 2, 1!
   */
  const playCountdownBeep = useCallback(
    (count: number) => {
      const ctx = getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const isCritical = count <= 3 && count >= 1;
      const pitch = isCritical ? 750 + (4 - count) * 160 : 440 + (10 - count) * 20;
      const duration = isCritical ? 0.14 : 0.08;
      const volume = isCritical ? 0.26 : 0.14;

      osc.type = isCritical ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    },
    [getContext]
  );

  return { playTick, playDrumroll, playChime, playWhoosh, playCountdownBeep };
}
