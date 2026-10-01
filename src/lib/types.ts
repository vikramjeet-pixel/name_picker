// ─── Participant ─────────────────────────────────────────────────
export interface Participant {
  id: string;
  fullName: string;
  identifier?: string; // email, phone, or other identifier
  ticketId?: string;
}

// ─── Prize Item (Tiered Reverse-Ladder Schema) ───────────────────
export interface PrizeItem {
  id: string;
  rank: number; // 1 = Grand Prize, 15 = Lowest Tier
  title: string;
  imageUrl: string; // File upload (data URL/base64) or fallback image URL
  description?: string;
  isDrawn: boolean;
  winner?: {
    name: string;
    identifier?: string; // Phone/email masked for privacy (e.g., "+44 **** 1234")
    drawnAt: string;
  };
}

// Legacy alias for compatibility where needed
export type PrizeTier = PrizeItem;

// ─── Audit Entry ─────────────────────────────────────────────────
export interface AuditEntry {
  roundId: string;
  prizeTierId: string;
  prizeTierName: string;
  prizeRank?: number;
  winner: Participant;
  timestamp: string; // ISO 8601
  drawHash: string;
  status: 'winner' | 'disqualified' | 'redrawn';
  replacedBy?: string; // roundId of the replacement draw
}

// ─── CSV Column Mapping ──────────────────────────────────────────
export interface ColumnMapping {
  fullName: string;
  identifier?: string;
  ticketId?: string;
}

// ─── Import Result ───────────────────────────────────────────────
export interface ImportResult {
  participants: Participant[];
  duplicateCount: number;
  errorCount: number;
  totalRows: number;
}

// ─── Draw State ──────────────────────────────────────────────────
export type AppStage =
  | 'importing'
  | 'configuring'
  | 'drawing'
  | 'revealing'
  | 'complete';

export interface DrawState {
  participants: Participant[];
  remainingPool: Participant[];
  prizes: PrizeItem[];
  currentPrizeIndex: number;
  drawHistory: AuditEntry[];
  settings: {
    removeWinnerFromPool: boolean;
  };
  stage: AppStage;
}

// ─── Reducer Actions ─────────────────────────────────────────────
export type DrawAction =
  | { type: 'SET_PARTICIPANTS'; payload: Participant[] }
  | { type: 'SET_PRIZES'; payload: PrizeItem[] }
  | { type: 'ADD_PRIZE'; payload: PrizeItem }
  | { type: 'REMOVE_PRIZE'; payload: string }
  | { type: 'UPDATE_PRIZE'; payload: PrizeItem }
  | { type: 'REORDER_PRIZES'; payload: PrizeItem[] }
  | { type: 'SET_CURRENT_PRIZE_INDEX'; payload: number }
  | { type: 'RECORD_WIN'; payload: AuditEntry }
  | { type: 'DISQUALIFY_WINNER'; payload: { roundId: string; replacementRoundId: string } }
  | { type: 'REMOVE_FROM_POOL'; payload: string } // participant id
  | { type: 'RESTORE_TO_POOL'; payload: Participant }
  | { type: 'TOGGLE_REMOVE_WINNER' }
  | { type: 'SET_STAGE'; payload: AppStage }
  | { type: 'RESET_PRIZE_DRAW_STATUS'; payload?: string } // reset one or all prizes
  | { type: 'RESET_ALL' }
  | { type: 'HYDRATE'; payload: DrawState };
