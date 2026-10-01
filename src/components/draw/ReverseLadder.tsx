'use client';

import type { PrizeItem } from '@/lib/types';
import { Check } from 'lucide-react';

interface ReverseLadderProps {
  prizes: PrizeItem[];
  activePrizeId?: string;
  onSelectPrize?: (prize: PrizeItem) => void;
  className?: string;
}

export function ReverseLadder({
  prizes,
  activePrizeId,
  onSelectPrize,
  className = '',
}: ReverseLadderProps) {
  // Rank 1 sits at the top of the list and the draw climbs towards it
  // from the bottom.
  const sortedPrizes = [...prizes].sort((a, b) => a.rank - b.rank);
  const drawnCount = sortedPrizes.filter((p) => p.isDrawn).length;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between pb-3 border-b-2 border-ink">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Prizes
        </h3>
        <span className="text-sm text-muted tabular-nums">
          {drawnCount} of {sortedPrizes.length} drawn
        </span>
      </div>

      {sortedPrizes.length === 0 ? (
        <p className="py-10 text-sm text-muted">No prizes set up yet.</p>
      ) : (
        <ol className="overflow-y-auto max-h-[640px]">
          {sortedPrizes.map((prize) => {
            const isActive = prize.id === activePrizeId;
            const isDrawn = prize.isDrawn;

            return (
              <li
                key={prize.id}
                onClick={() => onSelectPrize?.(prize)}
                aria-current={isActive ? 'true' : undefined}
                className={`relative flex items-center gap-3 py-2.5 pl-3 pr-2 border-b border-line cursor-pointer transition-colors ${
                  isActive ? 'bg-surface' : 'hover:bg-ink/[0.03]'
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 inset-y-0 w-[3px] bg-brand"
                    aria-hidden
                  />
                )}

                <span
                  className={`w-6 shrink-0 font-mono text-sm tabular-nums ${
                    isActive ? 'text-brand font-semibold' : 'text-muted'
                  }`}
                >
                  {String(prize.rank).padStart(2, '0')}
                </span>

                {prize.imageUrl && (
                  <img
                    src={prize.imageUrl}
                    alt=""
                    className={`w-8 h-8 shrink-0 object-contain ${
                      isDrawn && !isActive ? 'opacity-50' : ''
                    }`}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      isActive
                        ? 'font-semibold text-ink'
                        : isDrawn
                        ? 'text-muted'
                        : 'font-medium text-ink'
                    }`}
                  >
                    {prize.title}
                  </p>

                  {isDrawn && prize.winner && (
                    <p className="flex items-center gap-1 text-xs text-leaf">
                      <Check size={12} className="shrink-0" />
                      <span className="truncate">{prize.winner.name}</span>
                      {prize.winner.identifier && (
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          {prize.winner.identifier}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
