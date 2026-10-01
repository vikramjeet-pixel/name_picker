import Papa from 'papaparse';
import type { Participant, ColumnMapping, ImportResult } from './types';

/**
 * Auto-detect column mapping from CSV headers.
 */
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.trim().toLowerCase());

  const namePatterns = ['name', 'full name', 'fullname', 'participant', 'winner', 'person'];
  const identifierPatterns = ['email', 'phone', 'id', 'identifier', 'contact', 'mobile', 'tel', 'e-mail'];
  const ticketPatterns = ['ticket', 'ticket id', 'ticketid', 'ticket_id', 'ticket no', 'ticket number', 'serial'];

  const findMatch = (patterns: string[]): string | undefined => {
    for (const pattern of patterns) {
      const idx = lower.findIndex((h) => h === pattern || h.includes(pattern));
      if (idx !== -1) return headers[idx].trim();
    }
    return undefined;
  };

  const fullName = findMatch(namePatterns) || headers[0]?.trim() || '';

  return {
    fullName,
    identifier: findMatch(identifierPatterns),
    ticketId: findMatch(ticketPatterns),
  };
}

/**
 * Parse a CSV file and extract participants with validation.
 */
export function parseCSV(
  file: File,
  mapping?: ColumnMapping
): Promise<{ headers: string[]; data: Record<string, string>[]; mapping: ColumnMapping }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const detectedMapping = mapping || autoDetectColumns(headers);
        resolve({
          headers,
          data: results.data,
          mapping: detectedMapping,
        });
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

/**
 * Process raw CSV data into validated participants.
 */
export function processParticipants(
  data: Record<string, string>[],
  mapping: ColumnMapping
): ImportResult {
  const seen = new Set<string>();
  const participants: Participant[] = [];
  let duplicateCount = 0;
  let errorCount = 0;

  for (const row of data) {
    const fullName = row[mapping.fullName]?.trim();
    if (!fullName) {
      errorCount++;
      continue;
    }

    const identifier = mapping.identifier ? row[mapping.identifier]?.trim() : undefined;
    const ticketId = mapping.ticketId ? row[mapping.ticketId]?.trim() : undefined;

    // Composite key for dedup
    const key = `${fullName}|${identifier || ''}|${ticketId || ''}`.toLowerCase();

    if (seen.has(key)) {
      duplicateCount++;
      continue;
    }
    seen.add(key);

    // Generate a unique ID
    const idBytes = new Uint8Array(8);
    crypto.getRandomValues(idBytes);
    const id = Array.from(idBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    participants.push({
      id,
      fullName,
      identifier: identifier || undefined,
      ticketId: ticketId || undefined,
    });
  }

  return {
    participants,
    duplicateCount,
    errorCount,
    totalRows: data.length,
  };
}
