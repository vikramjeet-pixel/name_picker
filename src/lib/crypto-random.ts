import type { Participant } from './types';

/**
 * Generates a cryptographically secure random index in [0, max).
 * Uses rejection sampling to avoid modulo bias.
 */
function cryptoRandomIndex(max: number): number {
  if (max <= 0) throw new Error('Pool must have at least one participant');
  if (max === 1) return 0;

  const array = new Uint32Array(1);
  const maxUint32 = 0xFFFFFFFF;
  const limit = maxUint32 - (maxUint32 % max);

  // Rejection sampling to eliminate modulo bias
  let value: number;
  do {
    crypto.getRandomValues(array);
    value = array[0];
  } while (value >= limit);

  return value % max;
}

/**
 * Generates a 256-bit cryptographic seed as a hex string.
 */
function generateSeed(): string {
  const seedArray = new Uint8Array(32);
  crypto.getRandomValues(seedArray);
  return Array.from(seedArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a unique round ID using timestamp + random suffix.
 */
export function generateRoundId(): string {
  const timestamp = Date.now().toString(36);
  const randBytes = new Uint8Array(4);
  crypto.getRandomValues(randBytes);
  const suffix = Array.from(randBytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('');
  return `R-${timestamp}-${suffix}`.toUpperCase();
}

export interface SelectionResult {
  winner: Participant;
  seed: string;
  roundId: string;
}

/**
 * Provably fair winner selection using window.crypto.
 * Returns the selected winner, the cryptographic seed used, and a unique round ID.
 */
export function selectWinner(pool: Participant[]): SelectionResult {
  if (pool.length === 0) {
    throw new Error('Cannot select from an empty pool');
  }

  const seed = generateSeed();
  const roundId = generateRoundId();
  const index = cryptoRandomIndex(pool.length);

  return {
    winner: pool[index],
    seed,
    roundId,
  };
}
