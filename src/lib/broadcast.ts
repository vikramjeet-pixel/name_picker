import type { Participant, DrawState } from './types';

export type BroadcastMessage =
  | {
      type: 'CMD_START_DRAW';
      winner: Participant;
      seed: string;
      roundId: string;
      prizeTierId: string;
      prizeTierName: string;
      prizeRank?: number;
      prizeImage?: string;
    }
  | {
      type: 'CMD_SPIN_COMPLETE';
      winner: Participant;
      seed: string;
      roundId: string;
      prizeTierId: string;
      prizeTierName: string;
      prizeRank?: number;
      prizeImage?: string;
    }
  | {
      type: 'CMD_NEXT_DRAW';
    }
  | {
      type: 'CMD_DISQUALIFY_REDRAW';
      lastRoundId: string;
      nextResult: {
        winner: Participant;
        seed: string;
        roundId: string;
      };
      prizeTierId?: string;
      prizeTierName?: string;
      prizeRank?: number;
      prizeImage?: string;
    }
  | {
      type: 'CMD_RESET';
    }
  | {
      type: 'STATE_SYNC';
      state: DrawState;
    }
  | {
      type: 'AUDIENCE_PING';
    }
  | {
      type: 'AUDIENCE_PONG';
    };

const CHANNEL_NAME = 'star_luckydraw_channel';

class BroadcastBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: BroadcastMessage) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          const msg = event.data as BroadcastMessage;
          this.listeners.forEach((listener) => listener(msg));
        };
      } catch (err) {
        console.warn('BroadcastChannel not available:', err);
      }
    }
  }

  public send(msg: BroadcastMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('Failed to send broadcast message:', err);
      }
    }
  }

  public subscribe(listener: (msg: BroadcastMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const broadcastBus = new BroadcastBus();
