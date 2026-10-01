'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { Participant } from '@/lib/types';
import { useAudio } from '@/hooks/useAudio';
import { maskIdentifier } from '@/lib/mask';

interface WinnerRevealProps {
  winner: Participant;
  prizeName: string;
  prizeRank?: number;
  prizeImage?: string;
  drawHash: string;
  roundId: string;
}

const CONFETTI_COLORS = ['#d2202a', '#1c7a3f', '#1b1917', '#f2b824', '#ffffff'];

export function WinnerReveal({
  winner,
  prizeName,
  prizeRank,
  prizeImage,
  drawHash,
  roundId,
}: WinnerRevealProps) {
  const { playChime } = useAudio();
  const isGrandPrize = prizeRank === 1;
  const maskedId = maskIdentifier(winner.identifier);

  useEffect(() => {
    playChime();

    // Side streams for a few seconds, longer for the grand prize
    const duration = isGrandPrize ? 5000 : 3500;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: isGrandPrize ? 6 : 4,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors: CONFETTI_COLORS,
        zIndex: 9999,
      });
      confetti({
        particleCount: isGrandPrize ? 6 : 4,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors: CONFETTI_COLORS,
        zIndex: 9999,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Big center burst
    setTimeout(() => {
      confetti({
        particleCount: isGrandPrize ? 160 : 110,
        spread: isGrandPrize ? 120 : 100,
        origin: { x: 0.5, y: 0.45 },
        colors: CONFETTI_COLORS,
        zIndex: 9999,
        scalar: isGrandPrize ? 1.4 : 1.2,
      });
    }, 280);
  }, [playChime, isGrandPrize]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <div className="rounded-lg border-2 border-ink bg-surface">
        <div className="px-6 sm:px-10 py-8 sm:py-10">
          <p className="text-sm font-medium text-brand">
            {isGrandPrize ? 'Grand prize winner' : 'Winner'}
          </p>
          <h2 className="font-display mt-2 text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02] text-balance break-words">
            {winner.fullName}
          </h2>

          {/* Identifier is masked for privacy on the public screen */}
          {(winner.ticketId || maskedId) && (
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm sm:text-base text-muted">
              {winner.ticketId && <span>Ticket {winner.ticketId}</span>}
              {maskedId && <span>{maskedId}</span>}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-dashed border-ink/30 px-6 sm:px-10 py-4">
          {prizeImage && (
            <img
              src={prizeImage}
              alt=""
              className="w-10 h-10 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs text-muted">Wins</p>
            <p className="font-medium truncate">{prizeName}</p>
          </div>
        </div>
      </div>

      <p className="mt-3 font-mono text-[11px] text-muted break-all">
        Round {roundId} · {drawHash.slice(0, 16)}…
      </p>
    </motion.div>
  );
}
