'use client';

import React from 'react';
import type { AuditEntry } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';

interface DrawHistoryProps {
  history: AuditEntry[];
}

const statusBadgeVariant: Record<AuditEntry['status'], 'winner' | 'disqualified' | 'redrawn'> = {
  winner: 'winner',
  disqualified: 'disqualified',
  redrawn: 'redrawn',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

const th = 'px-3 py-2 text-left text-xs font-medium text-muted';

export function DrawHistory({ history }: DrawHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="py-10 border-y border-line text-sm text-muted">
        No draws yet. Results appear here as each prize is drawn.
      </p>
    );
  }

  // Show most recent first
  const sortedHistory = [...history].reverse();
  const winnerCount = history.filter((e) => e.status === 'winner').length;

  return (
    <div>
      <div className="flex items-baseline justify-between pb-2 border-b-2 border-ink">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Draw history
        </h3>
        <span className="text-sm text-muted tabular-nums">
          {winnerCount} {winnerCount === 1 ? 'winner' : 'winners'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Time</th>
              <th className={th}>Prize</th>
              <th className={th}>Winner</th>
              <th className={th}>Round</th>
              <th className={th}>Hash</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.map((entry, i) => (
              <tr
                key={`${entry.roundId}-${entry.status}-${i}`}
                className="border-b border-line"
              >
                <td className="px-3 py-2.5 text-muted tabular-nums whitespace-nowrap">
                  {formatTime(entry.timestamp)}
                </td>
                <td className="px-3 py-2.5">{entry.prizeTierName}</td>
                <td
                  className={`px-3 py-2.5 ${
                    entry.status === 'disqualified'
                      ? 'text-muted line-through'
                      : 'font-medium'
                  }`}
                >
                  {entry.winner.fullName}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted">
                  {entry.roundId.slice(0, 12)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted">
                  {entry.drawHash.slice(0, 12)}…
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant={statusBadgeVariant[entry.status]}
                    className="capitalize"
                  >
                    {entry.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
