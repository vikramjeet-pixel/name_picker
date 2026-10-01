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
const TOTAL_DURATION = 10000; // 10-second countdown
const WINNER_INDEX = 54; // Target item index where the winner lands
const TOTAL_ITEMS = 60; // Total sequence length

/**
 * Closed-form analytical progress function P(t) in [0, 1]
 * Derived from integrating an acceleration -> cruise -> continuous power-deceleration curve.
 * Guarantees zero velocity discontinuity and butter-smooth motion across 10 seconds.
 */
function getIntegratedProgress(elapsed: number, totalDuration: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed >= totalDuration) return 1;

  const t1 = 2000; // Acceleration phase: 0 -> 2s
  const t2 = 6200; // High-speed cruise phase: 2s -> 6.2s
  const T = totalDuration; // Total: 10s
  const alpha = 2.8; // Controlled deceleration ending cleanly at 10s

  const area1 = t1 / 2;
  const area2 = t2 - t1;
  const area3 = (T - t2) / (alpha + 1);
  const totalArea = area1 + area2 + area3;

  if (elapsed <= t1) {
    const a = 0.5 * (elapsed - (t1 / Math.PI) * Math.sin((Math.PI * elapsed) / t1));
    return a / totalArea;
  } else if (elapsed <= t2) {
    const a = area1 + (elapsed - t1);
    return a / totalArea;
  } else {
    const decelProgress = (elapsed - t2) / (T - t2);
    const a = area1 + area2 + area3 * (1 - Math.pow(1 - decelProgress, alpha + 1));
    return a / totalArea;
  }
}

export function SlotReel({ pool, winner, isSpinning, onSpinComplete }: SlotReelProps) {
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'locked'>('idle');
  const [countdown, setCountdown] = useState<number>(10);
  const [offsetY, setOffsetY] = useState<number>(CENTER_OFFSET);

  const animFrameRef = useRef<number>(0);
  const stopDrumrollRef = useRef<(() => void) | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCountdownSecRef = useRef<number>(10);
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

  // ─── Main Animation Loop (10-second countdown + physics) ────
  useEffect(() => {
    if (!isSpinning || frozenStripRef.current.length === 0) return;
    whooshPlayedRef.current = false;

    let cancelled = false;
    const startTime = performance.now();
    lastCountdownSecRef.current = 10;
    lastTickIndexRef.current = 0;
    // Start audio drumroll with 10s suspense ramp
    stopDrumrollRef.current = playDrumroll(10);

    const frame = (now: number) => {
      if (cancelled) return;

      const elapsed = now - startTime;
      const progress = getIntegratedProgress(elapsed, TOTAL_DURATION);

      // Compute continuous vertical offset
      const currentY = CENTER_OFFSET - progress * totalTravel;
      setOffsetY(currentY);

      // Audible mechanical tick on card boundaries
      const tickStep = Math.floor((CENTER_OFFSET - currentY) / (CARD_HEIGHT * 0.75));
      if (tickStep !== lastTickIndexRef.current) {
        lastTickIndexRef.current = tickStep;
        const remainingTime = Math.max(0, TOTAL_DURATION - elapsed);
        const isDecelerating = remainingTime < 3500;
        const tickPitch = isDecelerating ? 550 + (remainingTime / 3500) * 350 : 850;
        const tickVolume = isDecelerating ? 0.22 : 0.09;
        playTick(tickPitch, tickVolume);
      }

      // Suspenseful whoosh entering final 3 seconds
      if (elapsed >= 6800 && !whooshPlayedRef.current) {
        whooshPlayedRef.current = true;
        playWhoosh();
      }

      // Live 10-Second Countdown calculation
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
      setCountdown(10);
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
        setCountdown(10);
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
            style={{ width: `${(10 - countdown) * 10}%` }}
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
