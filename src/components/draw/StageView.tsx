'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrawStore } from '@/stores/draw-store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { selectWinner } from '@/lib/crypto-random';
import { createAuditEntry } from '@/lib/audit';
import type { Participant } from '@/lib/types';
import { SlotReel } from './SlotReel';
import { WinnerReveal } from './WinnerReveal';
import { X, Sparkles } from 'lucide-react';

interface StageViewProps {
  open: boolean;
  onClose: () => void;
}

export function StageView({ open, onClose }: StageViewProps) {
  const { state, dispatch } = useDrawStore();
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<{
    winner: (typeof state.participants)[0];
    seed: string;
    roundId: string;
  } | null>(null);
  const [showReveal, setShowReveal] = useState(false);

  const currentPrize = state.prizes[state.currentPrizeIndex];

  // ─── Batch Allocation ──────────────────────────────────────
  const drawNumber = state.prizes.filter((p) => p.isDrawn).length;
  const totalPrizes = state.prizes.length;

  const currentBatch: Participant[] = useMemo(() => {
    const participants = state.participants;
    if (participants.length === 0 || totalPrizes === 0) return [];

    const batchSize = Math.ceil(participants.length / totalPrizes);
    const batchIndex = drawNumber;
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, participants.length);

    if (start >= participants.length) return [];
    return participants.slice(start, end);
  }, [state.participants, totalPrizes, drawNumber]);

  const canDraw =
    !isSpinning &&
    currentBatch.length > 0 &&
    currentPrize &&
    !currentPrize.isDrawn &&
    state.stage !== 'complete';

  const handleStartDraw = useCallback(() => {
    if (!canDraw) return;

    setShowReveal(false);
    setIsSpinning(true);

    // Perform selection from current batch
    const result = selectWinner(currentBatch);
    setCurrentWinner(result);
  }, [canDraw, currentBatch]);

  const handleSpinComplete = useCallback(() => {
    setIsSpinning(false);
    setShowReveal(true);

    if (currentWinner && currentPrize) {
      const auditEntry = createAuditEntry(
        currentWinner.winner,
        currentWinner.roundId,
        currentWinner.seed,
        currentPrize.id,
        currentPrize.title
      );
      dispatch({ type: 'RECORD_WIN', payload: auditEntry });
    }
  }, [currentWinner, currentPrize, dispatch]);

  // Fullscreen management
  useEffect(() => {
    if (open) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [open]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && open) {
        onClose();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [open, onClose]);

  useKeyboardShortcuts({
    onSpace: handleStartDraw,
    onEscape: onClose,
    enabled: open,
  });

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
      style={{
        background:
          'radial-gradient(ellipse at center, #FFFFFF 0%, #F9FAFB 60%, #F3F4F6 100%)',
      }}
    >
      {/* Decorative floating particles in Star Red and Green */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: `${(i * 4.3) % 100}%`,
              y: `${(i * 7.1) % 100}%`,
              opacity: 0,
            }}
            animate={{
              opacity: [0, 0.4, 0],
              scale: [0.6, 1.2, 0.6],
              y: ['0%', '-15%', '0%'],
            }}
            transition={{
              duration: 4 + (i % 3) * 2,
              repeat: Infinity,
              delay: (i % 5) * 0.8,
            }}
            className={`absolute w-2 h-2 rounded-full ${
              i % 2 === 0 ? 'bg-red-400/30' : 'bg-green-500/30'
            }`}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10 cursor-pointer border border-gray-200"
        title="Exit Fullscreen (Esc)"
      >
        <X size={22} />
      </button>

      {/* Brand logo & Prize tier header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center flex flex-col items-center"
      >
        <img
          src="/logo.png"
          alt="Star Logo"
          className="h-16 sm:h-20 w-auto object-contain mb-3 drop-shadow-sm"
        />

        {currentPrize ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-2 bg-red-50 border border-red-200/80 px-4 py-1 rounded-full">
              <Sparkles size={14} className="text-red-600" />
              <span className="text-xs uppercase tracking-[0.25em] text-red-700 font-bold">
                Now Drawing
              </span>
              <Sparkles size={14} className="text-red-600" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              {currentPrize.title}
            </h1>
            {currentPrize.description && (
              <p className="mt-2 text-gray-500 text-sm max-w-md">{currentPrize.description}</p>
            )}
          </>
        ) : (
          <h1 className="text-3xl font-bold text-gray-800">STAR Lucky Draw</h1>
        )}
      </motion.div>

      {/* Slot Reel / Winner Reveal */}
      <div className="w-full max-w-3xl px-8">
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
                prizeName={currentPrize?.title || 'Winner'}
                prizeRank={currentPrize?.rank}
                prizeImage={currentPrize?.imageUrl}
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

      {/* Bottom controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-8 flex flex-col items-center gap-3"
      >
        {canDraw && !showReveal && (
          <button
            onClick={handleStartDraw}
            disabled={isSpinning}
            className="px-10 py-3.5 rounded-full bg-gradient-to-r from-red-600 to-red-700
              text-white font-bold text-lg
              hover:from-red-500 hover:to-red-600
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-xl shadow-red-600/30 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSpinning ? 'Drawing...' : '🎰 Start Draw'}
          </button>
        )}
        {showReveal && canDraw && (
          <button
            onClick={() => {
              setShowReveal(false);
              setCurrentWinner(null);
            }}
            className="px-10 py-3.5 rounded-full bg-gradient-to-r from-green-600 to-green-700
              text-white font-bold text-lg
              hover:from-green-500 hover:to-green-600
              shadow-xl shadow-green-600/30 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
          >
            🎉 Next Draw
          </button>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
          <span>
            Batch: <strong className="text-gray-800">{currentBatch.length}</strong> in current draw
          </span>
          <span>•</span>
          <span>Draw {drawNumber + 1} of {totalPrizes} • Space to draw · Esc to exit</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
