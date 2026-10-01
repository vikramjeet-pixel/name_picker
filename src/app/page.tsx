'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useDrawStore, getNextLadderPrize } from '@/stores/draw-store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { broadcastBus, type BroadcastMessage } from '@/lib/broadcast';
import { createAuditEntry } from '@/lib/audit';
import { selectWinner } from '@/lib/crypto-random';
import { rankLabel } from '@/lib/prize-presets';
import type { Participant, PrizeItem } from '@/lib/types';

import { SlotReel } from '@/components/draw/SlotReel';
import { WinnerReveal } from '@/components/draw/WinnerReveal';
import { ReverseLadder } from '@/components/draw/ReverseLadder';
import { Maximize, Minimize } from 'lucide-react';

export default function AudienceStagePage() {
  const { state, dispatch, hydrated } = useDrawStore();

  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedPrizeId, setSelectedPrizeId] = useState<string | null>(null);
  const [activeDrawPrize, setActiveDrawPrize] = useState<PrizeItem | null>(null);
  const [currentWinner, setCurrentWinner] = useState<{
    winner: Participant;
    seed: string;
    roundId: string;
    prizeTierId?: string;
    prizeTierName?: string;
  } | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [grandCountdown, setGrandCountdown] = useState<number>(5);

  // Keep ref to latest prizes for broadcast listener callbacks without stale closures
  const prizesRef = React.useRef(state.prizes);
  useEffect(() => {
    prizesRef.current = state.prizes;
  }, [state.prizes]);

  // Determine active prize in reverse-ladder order (bottom to top: highest rank number first)
  const nextLadderPrize = getNextLadderPrize(state.prizes);
  const currentPrize: PrizeItem | undefined =
    (selectedPrizeId
      ? state.prizes.find((p) => p.id === selectedPrizeId)
      : null) || nextLadderPrize;

  // While spinning or revealing a winner, lock the displayed prize to the exact prize drawn for this round
  // This prevents premature advancement to the next ladder tier while the celebration is showing!
  const displayPrize: PrizeItem | undefined =
    (isSpinning || showReveal) && activeDrawPrize
      ? activeDrawPrize
      : currentPrize;

  // ─── Batch Allocation ──────────────────────────────────────
  // Divide participants evenly across prizes. Each draw uses its own batch.
  // e.g., 1000 participants / 10 prizes = 100 per batch.
  // Draw 1 uses participants[0..99], Draw 2 uses participants[100..199], etc.
  const drawNumber = state.prizes.filter((p) => p.isDrawn).length; // how many draws completed
  const totalPrizes = state.prizes.length;

  const currentBatch: Participant[] = useMemo(() => {
    const participants = state.participants;
    if (participants.length === 0 || totalPrizes === 0) return [];

    const batchSize = Math.ceil(participants.length / totalPrizes);
    const batchIndex = drawNumber; // 0-based: first draw = batch 0
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, participants.length);

    // If we've exhausted all batches, return empty
    if (start >= participants.length) return [];

    return participants.slice(start, end);
  }, [state.participants, totalPrizes, drawNumber]);

  // When Grand Prize is revealed, keep popup visible for 5 seconds then transition to Grand Finale
  useEffect(() => {
    if (!showReveal || displayPrize?.rank !== 1) return;
    const timer = setInterval(() => {
      setGrandCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowReveal(false);
          setCurrentWinner(null);
          setSelectedPrizeId(null);
          setActiveDrawPrize(null);
          broadcastBus.send({ type: 'CMD_NEXT_DRAW' });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showReveal, displayPrize?.rank]);

  const canDraw =
    !isSpinning &&
    currentBatch.length > 0 &&
    currentPrize &&
    !currentPrize.isDrawn &&
    state.stage !== 'complete';

  // ─── Local Draw Trigger (e.g. Spacebar or direct click) ─────
  const triggerLocalDraw = useCallback(() => {
    if (!canDraw || !currentPrize) return;

    setShowReveal(false);
    setIsSpinning(true);
    setActiveDrawPrize(currentPrize);
    dispatch({ type: 'SET_STAGE', payload: 'drawing' });

    const result = selectWinner(currentBatch);
    setCurrentWinner({
      ...result,
      prizeTierId: currentPrize.id,
      prizeTierName: currentPrize.title,
    });

    // Notify other connected screens via BroadcastChannel
    broadcastBus.send({
      type: 'CMD_START_DRAW',
      winner: result.winner,
      seed: result.seed,
      roundId: result.roundId,
      prizeTierId: currentPrize.id,
      prizeTierName: currentPrize.title,
      prizeRank: currentPrize.rank,
      prizeImage: currentPrize.imageUrl,
    });
  }, [canDraw, currentBatch, currentPrize, dispatch]);

  const handleSpinComplete = useCallback(() => {
    setIsSpinning(false);
    setShowReveal(true);

    const prizeToAward = activeDrawPrize || currentPrize;
    if (currentWinner && prizeToAward) {
      const auditEntry = createAuditEntry(
        currentWinner.winner,
        currentWinner.roundId,
        currentWinner.seed,
        prizeToAward.id,
        prizeToAward.title,
        prizeToAward.rank
      );
      dispatch({ type: 'RECORD_WIN', payload: auditEntry });

      broadcastBus.send({
        type: 'CMD_SPIN_COMPLETE',
        winner: currentWinner.winner,
        seed: currentWinner.seed,
        roundId: currentWinner.roundId,
        prizeTierId: prizeToAward.id,
        prizeTierName: prizeToAward.title,
        prizeRank: prizeToAward.rank,
        prizeImage: prizeToAward.imageUrl,
      });
    }
  }, [currentWinner, activeDrawPrize, currentPrize, dispatch]);

  // ─── Cross-Screen Broadcast Bus Listener ────────────────────
  useEffect(() => {
    const unsubscribe = broadcastBus.subscribe((msg: BroadcastMessage) => {
      switch (msg.type) {
        case 'CMD_START_DRAW': {
          setShowReveal(false);
          const found = prizesRef.current.find((p) => p.id === msg.prizeTierId);
          const targetPrize: PrizeItem = found || {
            id: msg.prizeTierId,
            title: msg.prizeTierName,
            rank: msg.prizeRank ?? 1,
            imageUrl: msg.prizeImage || '',
            isDrawn: false,
          };
          setActiveDrawPrize(targetPrize);
          setSelectedPrizeId(msg.prizeTierId);
          setCurrentWinner({
            winner: msg.winner,
            seed: msg.seed,
            roundId: msg.roundId,
            prizeTierId: msg.prizeTierId,
            prizeTierName: msg.prizeTierName,
          });
          setIsSpinning(true);
          break;
        }

        case 'CMD_SPIN_COMPLETE': {
          setIsSpinning(false);
          setShowReveal(true);
          if (msg.prizeTierId) {
            const found = prizesRef.current.find((p) => p.id === msg.prizeTierId);
            const targetPrize: PrizeItem = found || {
              id: msg.prizeTierId,
              title: msg.prizeTierName,
              rank: msg.prizeRank ?? 1,
              imageUrl: msg.prizeImage || '',
              isDrawn: true,
            };
            setActiveDrawPrize(targetPrize);
          }
          setCurrentWinner({
            winner: msg.winner,
            seed: msg.seed,
            roundId: msg.roundId,
            prizeTierId: msg.prizeTierId,
            prizeTierName: msg.prizeTierName,
          });
          break;
        }

        case 'CMD_NEXT_DRAW':
          setShowReveal(false);
          setCurrentWinner(null);
          setIsSpinning(false);
          setSelectedPrizeId(null);
          setActiveDrawPrize(null);
          break;

        case 'CMD_DISQUALIFY_REDRAW': {
          setShowReveal(false);
          if (msg.prizeTierId) {
            const found = prizesRef.current.find((p) => p.id === msg.prizeTierId);
            if (found) setActiveDrawPrize(found);
          }
          setCurrentWinner({
            ...msg.nextResult,
            prizeTierId: msg.prizeTierId,
            prizeTierName: msg.prizeTierName,
          });
          setIsSpinning(true);
          break;
        }

        case 'CMD_RESET':
          setShowReveal(false);
          setCurrentWinner(null);
          setIsSpinning(false);
          setSelectedPrizeId(null);
          setActiveDrawPrize(null);
          break;

        case 'AUDIENCE_PING':
          broadcastBus.send({ type: 'AUDIENCE_PONG' });
          break;

        default:
          break;
      }
    });

    broadcastBus.send({ type: 'AUDIENCE_PONG' });

    return () => {
      unsubscribe();
    };
  }, []);

  // ─── Fullscreen Toggle ──────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── Keyboard Shortcuts ─────────────────────────────────────
  useKeyboardShortcuts({
    onSpace: () => {
      if (showReveal) {
        setShowReveal(false);
        setCurrentWinner(null);
        setSelectedPrizeId(null);
        setActiveDrawPrize(null);
        broadcastBus.send({ type: 'CMD_NEXT_DRAW' });
      } else if (canDraw) {
        triggerLocalDraw();
      }
    },
    onEscape: () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    },
    enabled: true,
  });

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-paper text-sm text-muted">
        Loading…
      </div>
    );
  }

  const isConfigured = state.participants.length > 0 && state.prizes.length > 0;
  const allDrawn = state.prizes.length > 0 && state.prizes.every((p) => p.isDrawn);
  // Show the closing screen only once every prize is drawn and no reveal or spin is active
  const showGrandFinale = allDrawn && !showReveal && !isSpinning;
  const grandPrizeItem = state.prizes.find((p) => p.rank === 1);
  const otherWinners = state.prizes
    .filter((p) => p.winner && p.rank !== 1)
    .sort((a, b) => a.rank - b.rank);
  const isGrandReveal = showReveal && displayPrize?.rank === 1;
  const statusLabel = showReveal ? 'Winner' : isSpinning ? 'Drawing' : 'Up next';

  const dismissReveal = () => {
    setShowReveal(false);
    setCurrentWinner(null);
    setSelectedPrizeId(null);
    setActiveDrawPrize(null);
    broadcastBus.send({ type: 'CMD_NEXT_DRAW' });
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper select-none">
      {/* ─── Header ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-4 border-b border-line">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Star Supermarket"
            className="h-11 sm:h-12 w-auto object-contain"
          />
          <div className="h-8 w-px bg-line" aria-hidden />
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
            Lucky Draw
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-md text-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <Link
            href="/admin"
            className="px-3 py-2 rounded-md text-sm text-muted hover:text-ink hover:bg-ink/5 transition-colors"
          >
            Admin
          </Link>
        </div>
      </header>

      {/* ─── Main ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-6 sm:px-10 py-8 sm:py-10">
        {!isConfigured ? (
          /* Standby: nothing imported yet */
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <img
              src="/logo.png"
              alt=""
              className="h-24 w-auto object-contain"
            />
            <h2 className="font-display mt-8 text-4xl sm:text-5xl font-semibold tracking-tight">
              The draw starts soon
            </h2>
            <p className="mt-3 text-muted max-w-sm">
              Entries and prizes are still being set up.
            </p>
            <Link
              href="/admin"
              className="mt-8 text-sm font-medium underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-colors"
            >
              Go to admin setup
            </Link>
          </div>
        ) : showGrandFinale ? (
          /* Closing screen: every prize has been drawn */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl mx-auto w-full"
          >
            <p className="text-sm font-medium text-brand">
              All {state.prizes.length} prizes drawn
            </p>
            <h2 className="font-display mt-2 text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              Congratulations to our winners
            </h2>

            {grandPrizeItem?.winner && (
              <div className="mt-10 border-y-2 border-ink py-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    Grand prize · {grandPrizeItem.title}
                  </p>
                  <p className="font-display mt-1 text-4xl sm:text-5xl font-bold tracking-tight break-words">
                    {grandPrizeItem.winner.name}
                  </p>
                </div>
                {grandPrizeItem.winner.identifier && (
                  <p className="font-mono text-sm text-muted">
                    {grandPrizeItem.winner.identifier}
                  </p>
                )}
              </div>
            )}

            {otherWinners.length > 0 && (
              <ol>
                {otherWinners.map((prize) => (
                  <li
                    key={prize.id}
                    className="flex items-baseline gap-4 py-3 border-b border-line"
                  >
                    <span className="w-7 shrink-0 font-mono text-sm text-muted tabular-nums">
                      {String(prize.rank).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium">
                      {prize.winner?.name}
                    </span>
                    <span className="max-w-[50%] truncate text-sm text-muted">
                      {prize.title}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <Link
              href="/admin"
              className="mt-8 inline-block text-sm font-medium underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition-colors"
            >
              See the full results in admin
            </Link>
          </motion.div>
        ) : (
          /* Live stage: prize list on the left, current draw on the right */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <aside className="lg:col-span-4 w-full">
              <ReverseLadder
                prizes={state.prizes}
                activePrizeId={displayPrize?.id}
                onSelectPrize={(prize) => {
                  if (!isSpinning && !showReveal) setSelectedPrizeId(prize.id);
                }}
              />
            </aside>

            <section className="lg:col-span-8 w-full">
              {/* Current prize */}
              <motion.div
                key={displayPrize?.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-5 sm:gap-7"
              >
                <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-lg border border-line bg-surface p-3 flex items-center justify-center">
                  {displayPrize?.imageUrl && (
                    <img
                      src={displayPrize.imageUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="text-brand">{statusLabel}</span>
                    {displayPrize && (
                      <span className="text-muted">
                        {' '}
                        · {rankLabel(displayPrize.rank)}
                      </span>
                    )}
                  </p>
                  <h2 className="font-display mt-1 text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-balance">
                    {displayPrize?.title}
                  </h2>
                  {displayPrize?.description && (
                    <p className="mt-2 text-muted max-w-xl">
                      {displayPrize.description}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Reel / winner */}
              <div className="mt-8">
                <AnimatePresence mode="wait">
                  {showReveal && currentWinner ? (
                    <motion.div
                      key="reveal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <WinnerReveal
                        winner={currentWinner.winner}
                        prizeName={displayPrize?.title || 'Winner'}
                        prizeRank={displayPrize?.rank}
                        prizeImage={displayPrize?.imageUrl}
                        drawHash={currentWinner.seed}
                        roundId={currentWinner.roundId}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="reel"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <SlotReel
                        pool={currentBatch}
                        winner={currentWinner?.winner || null}
                        isSpinning={isSpinning}
                        onSpinComplete={handleSpinComplete}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Presenter controls */}
              {canDraw && !showReveal && !isSpinning && (
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    onClick={triggerLocalDraw}
                    className="px-8 py-3.5 rounded-md bg-brand text-white text-lg font-semibold hover:bg-brand-dark active:translate-y-px transition-colors cursor-pointer"
                  >
                    Start draw
                  </button>
                  <span className="text-sm text-muted">
                    or press{' '}
                    <kbd className="font-mono text-xs border border-line rounded bg-surface px-1.5 py-0.5">
                      Space
                    </kbd>
                  </span>
                </div>
              )}

              {showReveal && (
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    onClick={dismissReveal}
                    className="px-8 py-3.5 rounded-md bg-ink text-white text-lg font-semibold hover:bg-ink/85 active:translate-y-px transition-colors cursor-pointer"
                  >
                    {isGrandReveal ? 'Show all winners' : 'Next prize'}
                  </button>
                  {isGrandReveal && (
                    <span className="text-sm text-muted tabular-nums">
                      Continuing in {grandCountdown}s
                    </span>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 sm:px-10 py-3 border-t border-line text-xs text-muted tabular-nums">
        <span>{currentBatch.length.toLocaleString()} in this draw</span>
        <span>{state.participants.length.toLocaleString()} entries</span>
        <span className="ml-auto">
          {drawNumber} of {totalPrizes} drawn
        </span>
      </footer>
    </div>
  );
}
