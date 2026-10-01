import type { AuditEntry } from './types';

/**
 * Export draw history as a downloadable CSV file.
 */
export function exportDrawResultsCSV(history: AuditEntry[]): void {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);

  const headers = [
    'Round',
    'Prize',
    'Winner Name',
    'Identifier',
    'Ticket ID',
    'Timestamp',
    'Draw Hash',
    'Status',
  ];

  const rows = history.map((entry) => [
    entry.roundId,
    entry.prizeTierName,
    entry.winner.fullName,
    entry.winner.identifier || '',
    entry.winner.ticketId || '',
    entry.timestamp,
    entry.drawHash,
    entry.status,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `draw_results_${timestamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
