import type { AuditEntry, Participant } from './types';

/**
 * Creates an audit entry for a successful draw.
 */
export function createAuditEntry(
  winner: Participant,
  roundId: string,
  drawHash: string,
  prizeTierId: string,
  prizeTierName: string,
  prizeRank?: number
): AuditEntry {
  return {
    roundId,
    prizeTierId,
    prizeTierName,
    prizeRank,
    winner: { ...winner },
    timestamp: new Date().toISOString(),
    drawHash,
    status: 'winner',
  };
}

/**
 * Marks an existing audit entry as disqualified and links to the replacement round.
 */
export function markDisqualified(
  history: AuditEntry[],
  roundId: string,
  replacementRoundId: string
): AuditEntry[] {
  return history.map((entry) => {
    if (entry.roundId === roundId) {
      return {
        ...entry,
        status: 'disqualified' as const,
        replacedBy: replacementRoundId,
      };
    }
    return entry;
  });
}
