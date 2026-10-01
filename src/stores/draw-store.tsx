'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { DrawState, DrawAction, AuditEntry, PrizeItem } from '@/lib/types';
import { markDisqualified } from '@/lib/audit';
import { broadcastBus } from '@/lib/broadcast';
import { maskIdentifier } from '@/lib/mask';
import { create10TierLadder } from '@/lib/prize-presets';

const STORAGE_KEY = 'star-luckydraw-state-v2';

const initialState: DrawState = {
  participants: [],
  remainingPool: [],
  prizes: create10TierLadder(),
  currentPrizeIndex: 0,
  drawHistory: [],
  settings: {
    removeWinnerFromPool: true,
  },
  stage: 'importing',
};

/**
 * Reverse-Ladder Helper:
 * Returns the next active prize to be drawn in bottom-to-top sequence
 * (highest rank number e.g. Rank 15/10 drawn first, climbing to Rank 1 Grand Prize).
 */
export function getNextLadderPrize(prizes: PrizeItem[]): PrizeItem | undefined {
  const undrawn = prizes.filter((p) => !p.isDrawn);
  if (undrawn.length === 0) return undefined;
  return [...undrawn].sort((a, b) => b.rank - a.rank)[0];
}

function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case 'SET_PARTICIPANTS':
      return {
        ...state,
        participants: action.payload,
        remainingPool: action.payload,
        stage: 'configuring',
      };

    case 'SET_PRIZES': {
      const sorted = [...action.payload].sort((a, b) => a.rank - b.rank);
      return { ...state, prizes: sorted };
    }

    case 'ADD_PRIZE': {
      const updated = [...state.prizes, action.payload].sort(
        (a, b) => a.rank - b.rank
      );
      return { ...state, prizes: updated };
    }

    case 'REMOVE_PRIZE':
      return {
        ...state,
        prizes: state.prizes.filter((p) => p.id !== action.payload),
      };

    case 'UPDATE_PRIZE': {
      const updated = state.prizes
        .map((p) => (p.id === action.payload.id ? action.payload : p))
        .sort((a, b) => a.rank - b.rank);
      return {
        ...state,
        prizes: updated,
      };
    }

    case 'REORDER_PRIZES': {
      const sorted = [...action.payload].sort((a, b) => a.rank - b.rank);
      return { ...state, prizes: sorted };
    }

    case 'SET_CURRENT_PRIZE_INDEX':
      return { ...state, currentPrizeIndex: action.payload };

    case 'RESET_PRIZE_DRAW_STATUS': {
      const targetId = action.payload;
      const updated = state.prizes.map((p) => {
        if (!targetId || p.id === targetId) {
          return {
            ...p,
            isDrawn: false,
            winner: undefined,
          };
        }
        return p;
      });
      return {
        ...state,
        prizes: updated,
        stage: 'drawing',
      };
    }

    case 'RECORD_WIN': {
      const entry: AuditEntry = action.payload;

      // Prevent duplicate recording of the same roundId
      if (state.drawHistory.some((e) => e.roundId === entry.roundId)) {
        return state;
      }

      const newHistory = [...state.drawHistory, entry];

      // Update matching prize item in the reverse ladder
      const updatedPrizes = state.prizes.map((p) => {
        if (p.id === entry.prizeTierId || p.title === entry.prizeTierName) {
          return {
            ...p,
            isDrawn: true,
            winner: {
              name: entry.winner.fullName,
              identifier: maskIdentifier(entry.winner.identifier),
              drawnAt: entry.timestamp,
            },
          };
        }
        return p;
      });

      // Remove winner from pool if setting enabled
      const newPool = state.settings.removeWinnerFromPool
        ? state.remainingPool.filter((p) => p.id !== entry.winner.id)
        : state.remainingPool;

      // Check if all prizes are drawn
      const allDrawn = updatedPrizes.every((p) => p.isDrawn);

      return {
        ...state,
        drawHistory: newHistory,
        remainingPool: newPool,
        prizes: updatedPrizes,
        stage: allDrawn ? 'complete' : 'revealing',
      };
    }

    case 'DISQUALIFY_WINNER': {
      const { roundId, replacementRoundId } = action.payload;
      const disqualifiedEntry = state.drawHistory.find(
        (e) => e.roundId === roundId
      );

      // Restore the disqualified winner to the pool
      let newPool = state.remainingPool;
      if (disqualifiedEntry && state.settings.removeWinnerFromPool) {
        newPool = [...state.remainingPool, disqualifiedEntry.winner];
      }

      // Reset isDrawn on the prize tier
      const updatedPrizes = state.prizes.map((p) => {
        if (
          p.id === disqualifiedEntry?.prizeTierId ||
          p.title === disqualifiedEntry?.prizeTierName
        ) {
          return {
            ...p,
            isDrawn: false,
            winner: undefined,
          };
        }
        return p;
      });

      return {
        ...state,
        drawHistory: markDisqualified(
          state.drawHistory,
          roundId,
          replacementRoundId
        ),
        remainingPool: newPool,
        prizes: updatedPrizes,
        stage: 'drawing',
      };
    }

    case 'REMOVE_FROM_POOL':
      return {
        ...state,
        remainingPool: state.remainingPool.filter(
          (p) => p.id !== action.payload
        ),
      };

    case 'RESTORE_TO_POOL':
      return {
        ...state,
        remainingPool: [...state.remainingPool, action.payload],
      };

    case 'TOGGLE_REMOVE_WINNER':
      return {
        ...state,
        settings: {
          ...state.settings,
          removeWinnerFromPool: !state.settings.removeWinnerFromPool,
        },
      };

    case 'SET_STAGE':
      return { ...state, stage: action.payload };

    case 'RESET_ALL':
      return {
        ...initialState,
        prizes: create10TierLadder(),
      };

    case 'HYDRATE': {
      const payload = action.payload;
      if (!payload) return state;
      const seen = new Set<string>();
      const dedupedHistory = (payload.drawHistory || []).filter((e) => {
        if (!e.roundId || seen.has(e.roundId)) return false;
        seen.add(e.roundId);
        return true;
      });

      // Ensure prizes have valid ranks and schema
      const hydratedPrizes =
        payload.prizes && payload.prizes.length > 0
          ? payload.prizes.map((p, idx) => ({
              ...p,
              rank: p.rank ?? idx + 1,
              title: p.title || (p as unknown as { name?: string }).name || `Prize #${idx + 1}`,
              imageUrl: p.imageUrl || '',
              isDrawn: !!p.isDrawn,
            }))
          : create10TierLadder();

      return {
        ...state,
        ...payload,
        prizes: hydratedPrizes.sort((a, b) => a.rank - b.rank),
        drawHistory: dedupedHistory,
      };
    }

    default:
      return state;
  }
}

interface DrawContextValue {
  state: DrawState;
  dispatch: React.Dispatch<DrawAction>;
  hydrated: boolean;
}

const DrawContext = createContext<DrawContextValue | null>(null);

function initDrawState(defaultState: DrawState): DrawState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as DrawState;
    }
  } catch {
    // Corrupted — start fresh
  }
  return defaultState;
}

export function DrawProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(drawReducer, initialState, initDrawState);
  const hydrated = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdateRef = useRef(false);

  // Listen to cross-tab updates via BroadcastChannel and storage events
  useEffect(() => {
    // Listen to BroadcastChannel for real-time state sync from other tabs
    const unsubscribe = broadcastBus.subscribe((msg) => {
      if (msg.type === 'STATE_SYNC') {
        isRemoteUpdateRef.current = true;
        dispatch({ type: 'HYDRATE', payload: msg.state });
      }
    });

    // Fallback: listen to window storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as DrawState;
          isRemoteUpdateRef.current = true;
          dispatch({ type: 'HYDRATE', payload: parsed });
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Debounced save to localStorage and broadcast to other tabs
  const saveToStorage = useCallback((stateToSave: DrawState) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch {
        // Storage full
      }
    }, 400);
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveToStorage(state);
      if (!isRemoteUpdateRef.current) {
        broadcastBus.send({ type: 'STATE_SYNC', state });
      }
      isRemoteUpdateRef.current = false;
    }
  }, [state, hydrated, saveToStorage]);

  return (
    <DrawContext.Provider value={{ state, dispatch, hydrated }}>
      {children}
    </DrawContext.Provider>
  );
}

export function useDrawStore(): DrawContextValue {
  const ctx = useContext(DrawContext);
  if (!ctx) {
    throw new Error('useDrawStore must be used within a DrawProvider');
  }
  return ctx;
}
