'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { Participant } from '@/lib/types';
import { useAudio } from '@/hooks/useAudio';

interface SlotReelProps {
  pool: Participant[];
  winner: Participant | null;
  isSpinning: boolean;
  onSpinComplete: () => void;
}

const CARD_HEIGHT = 76; // Height of each candidate item card in pixels
const VIEWPORT_HEIGHT = 228; // Exactly 3 visible items (76 * 3)
const CENTER_OFFSET = (VIEWPORT_HEIGHT - CARD_HEIGHT) / 2; // 76px
// ─── Spin timing (three phases, 14 seconds total) ───────────
//   Phase 1:  0s →  5s  very fast
//   Phase 2:  5s → 10s  noticeably slower
//   Phase 3: 10s → 14s  very slow crawl, gently stopping on the winner
const TOTAL_DURATION = 14000;
const TOTAL_SECONDS = TOTAL_DURATION / 1000;
const SLOW_PHASE_START = 10000; // When the final slow crawl begins

const FAST_SPEED = 25; // cards per second (phase 1)
const MEDIUM_SPEED = 8; // cards per second (phase 2)
const SLOW_SPEED = 2.5; // cards per second at the start of phase 3

/** Smooth 0→1 easing used to blend between speeds without a visible jolt. */
const ease = (x: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2;

/** Reel velocity (cards/second) at time t (seconds). */
function velocityAt(t: number): number {
  if (t < 0.4) return FAST_SPEED * ease(t / 0.4); // quick spin-up
  if (t < 5) return FAST_SPEED; // very fast
  if (t < 5.8) return FAST_SPEED + (MEDIUM_SPEED - FAST_SPEED) * ease((t - 5) / 0.8);
  if (t < 10) return MEDIUM_SPEED; // slower
  if (t < 10.6) return MEDIUM_SPEED + (SLOW_SPEED - MEDIUM_SPEED) * ease((t - 10) / 0.6);
  if (t < TOTAL_SECONDS) {
    // very slow crawl, easing down to a full stop exactly at the end
    const p = (t - 10.6) / (TOTAL_SECONDS - 10.6);
    return SLOW_SPEED * Math.pow(1 - p, 1.3);
  }
  return 0;
}

// Pre-integrate the velocity curve (1ms resolution) into a cumulative distance table.
const DISTANCE_TABLE: Float64Array = (() => {
  const table = new Float64Array(TOTAL_DURATION + 1);
  for (let ms = 1; ms <= TOTAL_DURATION; ms++) {
    const tMid = (ms - 0.5) / 1000;
    table[ms] = table[ms - 1] + velocityAt(tMid) / 1000;
  }
  return table;
})();

const TOTAL_CARDS_TRAVELLED = DISTANCE_TABLE[TOTAL_DURATION];
const WINNER_INDEX = Math.round(TOTAL_CARDS_TRAVELLED); // Target item index where the winner lands
const TOTAL_ITEMS = WINNER_INDEX + 6; // Total sequence length (a few names after the winner)

/** Progress P(t) in [0, 1] along the reel, following the three-phase velocity curve. */
function getIntegratedProgress(elapsed: number, totalDuration: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed >= totalDuration) return 1;

  const lo = Math.floor(elapsed);
  const frac = elapsed - lo;
  const d = DISTANCE_TABLE[lo] + (DISTANCE_TABLE[lo + 1] - DISTANCE_TABLE[lo]) * frac;
  return d / TOTAL_CARDS_TRAVELLED;
}

export function SlotReel({ pool, winner, isSpinning, onSpinComplete }: SlotReelProps) {
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'locked'>('idle');
  const [countdown, setCountdown] = useState<number>(TOTAL_SECONDS);
  const [offsetY, setOffsetY] = useState<number>(CENTER_OFFSET);

  const animFrameRef = useRef<number>(0);
  const stopDrumrollRef = useRef<(() => void) | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCountdownSecRef = useRef<number>(TOTAL_SECONDS);
  const lastTickIndexRef = useRef<number>(0);
  const whooshPlayedRef = useRef<boolean>(false);

  const { playTick, playDrumroll, playChime, playWhoosh, playCountdownBeep } = useAudio();

  // ─── Generate the rolling sequence strip ────────────────────
  // The winner is placed directly at WINNER_INDEX so the reel
  // naturally stops on the winner's name — no last-second swap.
  const itemsStrip: Participant[] = useMemo(() => {
    if (pool.length === 0) return [];

    const list: Participant[] = [];
    for (let i = 0; i < TOTAL_ITEMS; i++) {
      if (i === WINNER_INDEX && winner) {
        list.push(winner);
      } else {
        // Pick from pool, skipping the winner to avoid showing them twice near the end
        const filtered = pool.filter((p) => p.id !== winner?.id);
        const source = filtered.length > 0 ? filtered : pool;
        list.push(source[i % source.length]);
      }
    }
    return list;
  }, [pool, winner]);

  // ─── Frozen snapshot ref ────────────────────────────────────
  // Once a spin starts, freeze the strip so that downstream state changes
  // (e.g., RECORD_WIN removing the winner from the pool) don't recalculate
  // the strip and cause visible name switches mid-animation.
  const frozenStripRef = useRef<Participant[]>(itemsStrip);

  // Capture snapshot when spin begins; keep it stable during spin & locked phases
  useEffect(() => {
    if (isSpinning && itemsStrip.length > 0) {
      frozenStripRef.current = itemsStrip;
    }
  }, [isSpinning]); // intentionally only depend on isSpinning to capture once

  // Use frozen data while spinning or locked, live data when idle
  const activeStrip = (phase === 'spinning' || phase === 'locked')
    ? frozenStripRef.current
    : itemsStrip;

  // Total travel distance from item 0 to WINNER_INDEX
  const totalTravel = WINNER_INDEX * CARD_HEIGHT;

  // ─── Main Animation Loop (14-second countdown + physics) ────
  useEffect(() => {
    if (!isSpinning || frozenStripRef.current.length === 0) return;
    whooshPlayedRef.current = false;

    let cancelled = false;
    const startTime = performance.now();
    lastCountdownSecRef.current = TOTAL_SECONDS;
    lastTickIndexRef.current = 0;
    // Start audio drumroll ramping over the full spin
    stopDrumrollRef.current = playDrumroll(TOTAL_SECONDS);

    const frame = (now: number) => {
      if (cancelled) return;

      const elapsed = now - startTime;
      const progress = getIntegratedProgress(elapsed, TOTAL_DURATION);

      // Compute continuous vertical offset
      const currentY = CENTER_OFFSET - progress * totalTravel;
      setOffsetY(currentY);

      // Audible mechanical tick each time a new name passes the centre line
      const tickStep = Math.floor((CENTER_OFFSET - currentY) / CARD_HEIGHT);
      if (tickStep !== lastTickIndexRef.current) {
        lastTickIndexRef.current = tickStep;
        const slowWindow = TOTAL_DURATION - SLOW_PHASE_START;
        const remainingTime = Math.max(0, TOTAL_DURATION - elapsed);
        const isDecelerating = elapsed >= SLOW_PHASE_START;
        const tickPitch = isDecelerating ? 550 + (remainingTime / slowWindow) * 350 : 850;
        const tickVolume = isDecelerating ? 0.22 : 0.09;
        playTick(tickPitch, tickVolume);
      }

      // Suspenseful whoosh as the final slow crawl begins
      if (elapsed >= SLOW_PHASE_START && !whooshPlayedRef.current) {
        whooshPlayedRef.current = true;
        playWhoosh();
      }

      // Live countdown calculation
      const secondsLeft = Math.max(0, Math.ceil((TOTAL_DURATION - elapsed) / 1000));
      if (secondsLeft !== lastCountdownSecRef.current) {
        lastCountdownSecRef.current = secondsLeft;
        setCountdown(secondsLeft);
        if (secondsLeft >= 1) {
          playCountdownBeep(secondsLeft);
        }
      }

      if (elapsed < TOTAL_DURATION) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        // ─── Countdown Complete: NOW reveal and lock on Winner! ───
        setPhase('locked');
        setCountdown(0);
        setOffsetY(CENTER_OFFSET - totalTravel);

        stopDrumrollRef.current?.();
        stopDrumrollRef.current = null;
        playChime();

        // Hold winner display in center spotlight for 1.2s before triggering full celebration
        finishTimeoutRef.current = setTimeout(() => {
          if (!cancelled) {
            onSpinComplete();
          }
        }, 1200);
      }
    };

    animFrameRef.current = requestAnimationFrame((now) => {
      setPhase('spinning');
      setCountdown(TOTAL_SECONDS);
      frame(now);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
      }
      stopDrumrollRef.current?.();
      stopDrumrollRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSpinning,
    totalTravel,
    onSpinComplete,
    playTick,
    playDrumroll,
    playChime,
    playWhoosh,
    playCountdownBeep,
  ]);

  // Reset when draw fully concludes (no winner displayed)
  // CRITICAL: Do NOT reset while phase is 'locked' — that would snap the reel
  // away from the winner back to idle position. Only reset when we truly
  // have no winner to display anymore (i.e., the reveal was dismissed).
  useEffect(() => {
    if (!isSpinning && !winner) {
      const handle = requestAnimationFrame(() => {
        setPhase('idle');
        setCountdown(TOTAL_SECONDS);
        setOffsetY(CENTER_OFFSET);
      });
      return () => cancelAnimationFrame(handle);
    }
  }, [isSpinning, winner]);

  // Calculate current active window for DOM virtualization (performance optimization)
  const activeCenterIndex = Math.min(
    activeStrip.length - 1,
    Math.max(0, Math.round((CENTER_OFFSET - offsetY) / CARD_HEIGHT))
  );

  const visibleWindowStart = Math.max(0, activeCenterIndex - 4);
  const visibleWindowEnd = Math.min(activeStrip.length - 1, activeCenterIndex + 4);

  const isLocked = phase === 'locked';

  return (
    <div className="w-full">
      {/* ─── Status line and countdown ───────────────────────── */}
      <div className="flex items-end justify-between h-10 mb-3">
        <span className="text-sm text-muted">
          {isLocked
            ? 'Winner'
            : isSpinning
            ? 'Drawing'
            : `${pool.length.toLocaleString()} ${pool.length === 1 ? 'entry' : 'entries'} in this draw`}
        </span>
        {isSpinning && !isLocked && (
          <span
            className={`font-display text-4xl font-semibold leading-none tabular-nums ${
              countdown <= 3 ? 'text-brand' : 'text-ink'
            }`}
          >
            {countdown}
          </span>
        )}
      </div>

      {/* ─── Reel viewport ───────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-lg border border-line bg-surface"
        style={{ height: `${VIEWPORT_HEIGHT}px` }}
      >
        {/* Time elapsed */}
        {isSpinning && (
          <div
            className="absolute top-0 left-0 z-30 h-0.5 bg-brand transition-[width] duration-1000 ease-linear"
            style={{ width: `${((TOTAL_SECONDS - countdown) / TOTAL_SECONDS) * 100}%` }}
          />
        )}

        {/* Centre row tint (sits under the names) */}
        <div
          className={`absolute inset-x-0 transition-colors duration-300 ${
            isLocked ? 'bg-brand-tint' : 'bg-transparent'
          }`}
          style={{ top: `${CENTER_OFFSET}px`, height: `${CARD_HEIGHT}px` }}
        />

        {/* Centre row rules (sit over the names) */}
        <div
          className={`absolute inset-x-0 z-20 pointer-events-none border-y-2 transition-colors duration-300 ${
            isLocked ? 'border-brand' : 'border-ink'
          }`}
          style={{ top: `${CENTER_OFFSET}px`, height: `${CARD_HEIGHT}px` }}
        />

        {/* Fade the rows above and below */}
        <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-surface to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-surface to-transparent z-10 pointer-events-none" />

        {phase === 'idle' && !winner ? (
          <div className="relative w-full h-full flex items-center px-6 sm:px-8">
            <p className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink/25">
              Ready to draw
            </p>
          </div>
        ) : (
          /* Sliding track */
          <div
            className="absolute inset-x-0 will-change-transform"
            style={{
              transform: `translate3d(0px, ${offsetY}px, 0px)`,
            }}
          >
            {activeStrip.map((item, idx) => {
              // Render only items in the visible window for high performance
              if (idx < visibleWindowStart || idx > visibleWindowEnd) {
                return (
                  <div
                    key={item.id + '_' + idx}
                    style={{ height: `${CARD_HEIGHT}px` }}
                    className="w-full pointer-events-none invisible"
                  />
                );
              }

              const isCenter = idx === activeCenterIndex;

              // The winner is ALREADY at WINNER_INDEX in the strip.
              // The reel stops there naturally — no name swap needed.
              // This flag is for STYLING only.
              const isWinnerLocked = idx === WINNER_INDEX && isLocked;

              return (
                <div
                  key={item.id + '_' + idx}
                  style={{ height: `${CARD_HEIGHT}px` }}
                  className="w-full px-6 sm:px-8 flex items-center justify-between gap-4 select-none"
                >
                  <span
                    className={`min-w-0 truncate font-display text-2xl sm:text-3xl font-semibold tracking-tight transition-colors duration-150 ${
                      isWinnerLocked
                        ? 'text-brand'
                        : isCenter
                        ? 'text-ink'
                        : 'text-ink/30'
                    }`}
                  >
                    {item.fullName}
                  </span>
                  {item.ticketId && (
                    <span
                      className={`shrink-0 font-mono text-sm transition-colors duration-150 ${
                        isCenter ? 'text-muted' : 'text-ink/20'
                      }`}
                    >
                      {item.ticketId}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
