'use client';

import React, { useState, useCallback } from 'react';
import { useDrawStore } from '@/stores/draw-store';
import { exportDrawResultsCSV } from '@/lib/export';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Play,
  RotateCcw,
  Download,
  UserX,
  ToggleLeft,
  ToggleRight,
  Maximize,
  ChevronDown,
} from 'lucide-react';

interface DrawControlsProps {
  onStartDraw: () => void;
  onDisqualifyRedraw: () => void;
  onEnterStage: () => void;
  isSpinning: boolean;
  lastRoundId?: string | null;
  hasWinner: boolean;
}

export function DrawControls({
  onStartDraw,
  onDisqualifyRedraw,
  onEnterStage,
  isSpinning,
  hasWinner,
}: DrawControlsProps) {
  const { state, dispatch } = useDrawStore();
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);

  const currentPrize = state.prizes[state.currentPrizeIndex];
  const isComplete = state.stage === 'complete';
  const canDraw =
    !isSpinning &&
    !isComplete &&
    state.remainingPool.length > 0 &&
    currentPrize &&
    !currentPrize.isDrawn;

  const handleExport = useCallback(() => {
    if (state.drawHistory.length > 0) {
      exportDrawResultsCSV(state.drawHistory);
    }
  }, [state.drawHistory]);

  const handleDisqualify = () => {
    setShowDisqualifyModal(false);
    onDisqualifyRedraw();
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Current prize indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Drawing for:</span>
            {currentPrize ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-red-600">
                  {currentPrize.title}
                </span>
                <Badge variant="gold">
                  {currentPrize.isDrawn ? 'Drawn' : 'Pending'}
                </Badge>
              </div>
            ) : (
              <Badge variant="default">No prize selected</Badge>
            )}
          </div>

          {/* Prize selector */}
          {state.prizes.length > 1 && (
            <div className="relative">
              <select
                value={state.currentPrizeIndex}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_CURRENT_PRIZE_INDEX',
                    payload: Number(e.target.value),
                  })
                }
                disabled={isSpinning}
                className="appearance-none rounded-lg border border-gray-300 bg-white px-3 py-1.5 pr-8 text-sm text-gray-700
                  focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer disabled:opacity-50"
              >
                {state.prizes.map((p, i) => (
                  <option key={p.id} value={i}>
                    {p.title} ({p.isDrawn ? 'Drawn' : 'Pending'})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="gold"
            size="lg"
            icon={<Play size={18} />}
            onClick={onStartDraw}
            disabled={!canDraw}
          >
            {isSpinning ? 'Drawing...' : 'Start Draw'}
          </Button>

          <Button
            variant="danger"
            size="md"
            icon={<UserX size={16} />}
            onClick={() => setShowDisqualifyModal(true)}
            disabled={!hasWinner || isSpinning}
          >
            Disqualify & Redraw
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<Maximize size={16} />}
            onClick={onEnterStage}
          >
            Stage Mode
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<Download size={16} />}
            onClick={handleExport}
            disabled={state.drawHistory.length === 0}
          >
            Export CSV
          </Button>

          {/* Remove winner toggle */}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_REMOVE_WINNER' })}
            disabled={isSpinning}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-800
              disabled:opacity-50 transition-colors cursor-pointer"
          >
            {state.settings.removeWinnerFromPool ? (
              <ToggleRight size={20} className="text-green-600" />
            ) : (
              <ToggleLeft size={20} className="text-gray-400" />
            )}
            Remove winners from pool
          </button>
        </div>

        {/* Pool count */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>
            Pool: <span className="text-gray-700 font-medium">{state.remainingPool.length}</span>{' '}
            remaining
          </span>
          <span>
            Draws: <span className="text-gray-700 font-medium">{state.drawHistory.filter(e => e.status === 'winner').length}</span>{' '}
            completed
          </span>
          <span className="text-gray-300">Press Space to draw</span>
        </div>
      </div>

      {/* Disqualify confirmation modal */}
      <Modal
        open={showDisqualifyModal}
        onClose={() => setShowDisqualifyModal(false)}
        title="Disqualify & Redraw"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will disqualify the current winner and trigger a new draw for
            the same prize tier. The action will be recorded in the audit log.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowDisqualifyModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              icon={<RotateCcw size={14} />}
              onClick={handleDisqualify}
            >
              Confirm Disqualify
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
