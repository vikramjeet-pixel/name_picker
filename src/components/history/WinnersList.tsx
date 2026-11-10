'use client';

import React from 'react';
import type { AuditEntry } from '@/lib/types';
import { rankLabel } from '@/lib/prize-presets';
import { Phone, MapPin } from 'lucide-react';

interface WinnersListProps {
  history: AuditEntry[];
}

/**
 * Full, unmasked winner details (name, phone/email, address) for each
 * awarded prize. Disqualified entries are left out — they stay in the
 * draw history log below.
 */
export function WinnersList({ history }: WinnersListProps) {
  const winners = history
    .filter((e) => e.status === 'winner')
    .sort((a, b) => (a.prizeRank ?? Infinity) - (b.prizeRank ?? Infinity));

  return (
    <div>
      <div className="flex items-baseline justify-between pb-2 border-b-2 border-ink">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Winners
        </h3>
        <span className="text-sm text-muted tabular-nums">
          {winners.length} {winners.length === 1 ? 'winner' : 'winners'}
        </span>
      </div>

      {winners.length === 0 ? (
        <p className="py-10 border-b border-line text-sm text-muted">
          No winners yet. Each winner&apos;s name, phone and address appear here
          as soon as they are drawn.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {winners.map((entry) => (
            <li
              key={entry.roundId}
              className="rounded-lg border border-line bg-surface p-5"
            >
              <p className="text-sm text-muted">
                {entry.prizeRank != null && `${rankLabel(entry.prizeRank)} · `}
                {entry.prizeTierName}
              </p>
              <p className="font-display mt-1 text-2xl font-semibold tracking-tight break-words">
                {entry.winner.fullName}
              </p>

              <dl className="mt-3 space-y-2 text-base">
                <div className="flex items-start gap-2">
                  <dt className="mt-1 text-muted">
                    <Phone size={16} aria-label="Phone" />
                  </dt>
                  <dd className="font-medium break-all">
                    {entry.winner.identifier || (
                      <span className="text-muted font-normal">Not provided</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-start gap-2">
                  <dt className="mt-1 text-muted">
                    <MapPin size={16} aria-label="Address" />
                  </dt>
                  <dd className="font-medium break-words">
                    {entry.winner.address || (
                      <span className="text-muted font-normal">Not provided</span>
                    )}
                  </dd>
                </div>
              </dl>

              {entry.winner.ticketId && (
                <p className="mt-3 font-mono text-xs text-muted">
                  Ticket {entry.winner.ticketId}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

