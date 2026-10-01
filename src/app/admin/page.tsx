'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useDrawStore, getNextLadderPrize } from '@/stores/draw-store';
import { parseCSV, processParticipants } from '@/lib/csv-parser';
import { selectWinner } from '@/lib/crypto-random';
import { createAuditEntry } from '@/lib/audit';
import { exportDrawResultsCSV } from '@/lib/export';
import { broadcastBus, type BroadcastMessage } from '@/lib/broadcast';
import { rankLabel } from '@/lib/prize-presets';
import type { ColumnMapping, Participant, PrizeItem } from '@/lib/types';

import { DropZone } from '@/components/csv-importer/DropZone';
import { ColumnMapper } from '@/components/csv-importer/ColumnMapper';
import { ImportSummary } from '@/components/csv-importer/ImportSummary';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PrizeManager } from '@/components/prizes/PrizeManager';
import { DrawHistory } from '@/components/history/DrawHistory';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

import {
  Play,
  Lock,
  ExternalLink,
  RotateCcw,
  UserX,
  Eye,
  EyeOff,
  ChevronDown,
  Download,
} from 'lucide-react';

type AdminTab = 'import' | 'prizes' | 'draw' | 'results' | 'settings';

const DEFAULT_PIN = '1234';
const PIN_STORAGE_KEY = 'star_admin_pin';
const AUTH_SESSION_KEY = 'star_admin_auth';

export default function AdminPage() {
  const { state, dispatch } = useDrawStore();

  // ─── Authentication State ──────────────────────────────────
  // null until the session has been checked on the client, so the server
  // render and the first client render match.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setIsAuthenticated(sessionStorage.getItem(AUTH_SESSION_KEY) === 'true');
    });
    return () => cancelAnimationFrame(handle);
  }, []);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Settings: Change PIN
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeMessage, setPinChangeMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // ─── Admin Navigation & Tabs ───────────────────────────────
  const [activeTab, setActiveTab] = useState<AdminTab>('import');

  // ─── CSV Import State ──────────────────────────────────────
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [importResult, setImportResult] = useState<{
    totalRows: number;
    eligible: number;
    duplicates: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ─── Draw State & Sync ─────────────────────────────────────
  const [selectedPrizeId, setSelectedPrizeId] = useState<string | null>(null);
  const [isAudienceSpinning, setIsAudienceSpinning] = useState(false);
  const [activeDrawPrize, setActiveDrawPrize] = useState<PrizeItem | null>(null);
  const [activeWinner, setActiveWinner] = useState<{
    winner: Participant;
    seed: string;
    roundId: string;
  } | null>(null);
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);
  const [isAudienceConnected, setIsAudienceConnected] = useState(false);
  const [adminCountdown, setAdminCountdown] = useState<number>(10);

  // Live 10s countdown for Admin mirror during spin
  useEffect(() => {
    if (!isAudienceSpinning) return;
    const timer = setInterval(() => {
      setAdminCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAudienceSpinning]);

  // Modals
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Keep ref to latest prizes for broadcast listener callbacks without stale closures
  const prizesRef = React.useRef(state.prizes);
  useEffect(() => {
    prizesRef.current = state.prizes;
  }, [state.prizes]);

  // ─── Cross-Screen BroadcastChannel Sync ─────────────────────
  useEffect(() => {
    const unsubscribe = broadcastBus.subscribe((msg: BroadcastMessage) => {
      switch (msg.type) {
        case 'AUDIENCE_PONG':
          setIsAudienceConnected(true);
          break;

        case 'CMD_START_DRAW': {
          setIsAudienceSpinning(true);
          const found = prizesRef.current.find((p) => p.id === msg.prizeTierId);
          setActiveDrawPrize(
            found || {
              id: msg.prizeTierId,
              title: msg.prizeTierName,
              rank: msg.prizeRank ?? 1,
              imageUrl: msg.prizeImage || '',
              isDrawn: false,
            }
          );
          setActiveWinner({
            winner: msg.winner,
            seed: msg.seed,
            roundId: msg.roundId,
          });
          break;
        }

        case 'CMD_SPIN_COMPLETE': {
          setIsAudienceSpinning(false);
          if (msg.prizeTierId) {
            const found = prizesRef.current.find((p) => p.id === msg.prizeTierId);
            setActiveDrawPrize(
              found || {
                id: msg.prizeTierId,
                title: msg.prizeTierName,
                rank: msg.prizeRank ?? 1,
                imageUrl: msg.prizeImage || '',
                isDrawn: true,
              }
            );
          }
          setActiveWinner({
            winner: msg.winner,
            seed: msg.seed,
            roundId: msg.roundId,
          });
          setLastRoundId(msg.roundId);
          break;
        }

        case 'CMD_NEXT_DRAW':
          setIsAudienceSpinning(false);
          setActiveWinner(null);
          setActiveDrawPrize(null);
          setSelectedPrizeId(null);
          break;

        case 'CMD_RESET':
          setIsAudienceSpinning(false);
          setActiveWinner(null);
          setActiveDrawPrize(null);
          setSelectedPrizeId(null);
          setLastRoundId(null);
          break;

        default:
          break;
      }
    });

    // Ping audience screen to test connection
    broadcastBus.send({ type: 'AUDIENCE_PING' });

    const interval = setInterval(() => {
      broadcastBus.send({ type: 'AUDIENCE_PING' });
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // ─── PIN Login Handler ──────────────────────────────────────
  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const storedPin = localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
    if (pinInput === storedPin) {
      setIsAuthenticated(true);
      setPinError(false);
      setPinInput('');
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    } else {
      setPinError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  };

  const handlePinChange = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
    if (currentPinInput !== storedPin) {
      setPinChangeMessage({ type: 'error', text: 'Current PIN is incorrect.' });
      return;
    }
    if (newPinInput.length < 4) {
      setPinChangeMessage({
        type: 'error',
        text: 'New PIN must be at least 4 digits.',
      });
      return;
    }
    localStorage.setItem(PIN_STORAGE_KEY, newPinInput);
    setCurrentPinInput('');
    setNewPinInput('');
    setPinChangeMessage({
      type: 'success',
      text: 'Admin PIN updated successfully!',
    });
  };

  // ─── CSV Import Handlers ────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    setIsImporting(true);
    try {
      const { headers, data, mapping } = await parseCSV(file);
      setCsvHeaders(headers);
      setCsvData(data);
      setColumnMapping(mapping);

      const result = processParticipants(data, mapping);
      setImportResult({
        totalRows: result.totalRows,
        eligible: result.participants.length,
        duplicates: result.duplicateCount,
      });
    } catch (err) {
      console.error('CSV parse error:', err);
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleMappingChange = useCallback(
    (newMapping: ColumnMapping) => {
      setColumnMapping(newMapping);
      if (csvData.length > 0) {
        const result = processParticipants(csvData, newMapping);
        setImportResult({
          totalRows: result.totalRows,
          eligible: result.participants.length,
          duplicates: result.duplicateCount,
        });
      }
    },
    [csvData]
  );

  const handleConfirmImport = useCallback(() => {
    if (!columnMapping || csvData.length === 0) return;
    const result = processParticipants(csvData, columnMapping);
    dispatch({ type: 'SET_PARTICIPANTS', payload: result.participants });
    setActiveTab('prizes');
  }, [columnMapping, csvData, dispatch]);

  // ─── Draw Logic (Reverse-Ladder Operator Controls) ─────────
  const nextLadderPrize = getNextLadderPrize(state.prizes);
  const currentPrize =
    (selectedPrizeId
      ? state.prizes.find((p) => p.id === selectedPrizeId)
      : null) || nextLadderPrize;

  // During spinning or while showing active winner, keep display focused on the drawn prize
  // This prevents jumping to the next prize before "Next Draw Ready" is pressed
  const displayPrize =
    (isAudienceSpinning || activeWinner) && activeDrawPrize
      ? activeDrawPrize
      : currentPrize;

  // ─── Batch Allocation ──────────────────────────────────────
  const drawNumber = state.prizes.filter((p) => p.isDrawn).length;
  const totalPrizes = state.prizes.length;

  const currentBatch: Participant[] = useMemo(() => {
    const participants = state.participants;
    if (participants.length === 0 || totalPrizes === 0) return [];

    const batchSize = Math.ceil(participants.length / totalPrizes);
    const batchIndex = drawNumber;
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, participants.length);

    if (start >= participants.length) return [];
    return participants.slice(start, end);
  }, [state.participants, totalPrizes, drawNumber]);

  const canDraw =
    !isAudienceSpinning &&
    !activeWinner &&
    currentBatch.length > 0 &&
    currentPrize &&
    !currentPrize.isDrawn &&
    state.stage !== 'complete';

  const handleTriggerDraw = useCallback(() => {
    if (!canDraw || !currentPrize) return;

    const targetPrize = currentPrize;
    setActiveWinner(null);
    setActiveDrawPrize(targetPrize);
    setIsAudienceSpinning(true);
    setAdminCountdown(10);
    dispatch({ type: 'SET_STAGE', payload: 'drawing' });

    // Cryptographic Selection
    const result = selectWinner(currentBatch);

    // Broadcast command to Audience screen
    broadcastBus.send({
      type: 'CMD_START_DRAW',
      winner: result.winner,
      seed: result.seed,
      roundId: result.roundId,
      prizeTierId: targetPrize.id,
      prizeTierName: targetPrize.title,
      prizeRank: targetPrize.rank,
      prizeImage: targetPrize.imageUrl,
    });

    // Mirror spin completion after 10s reel countdown + 1200ms lock hold
    setTimeout(() => {
      setIsAudienceSpinning(false);
      setActiveWinner(result);
      const auditEntry = createAuditEntry(
        result.winner,
        result.roundId,
        result.seed,
        targetPrize.id,
        targetPrize.title,
        targetPrize.rank
      );
      dispatch({ type: 'RECORD_WIN', payload: auditEntry });
      setLastRoundId(result.roundId);

      broadcastBus.send({
        type: 'CMD_SPIN_COMPLETE',
        winner: result.winner,
        seed: result.seed,
        roundId: result.roundId,
        prizeTierId: targetPrize.id,
        prizeTierName: targetPrize.title,
        prizeRank: targetPrize.rank,
        prizeImage: targetPrize.imageUrl,
      });
    }, 11200);
  }, [canDraw, currentPrize, currentBatch, dispatch]);

  const handleNextDraw = useCallback(() => {
    setActiveWinner(null);
    setActiveDrawPrize(null);
    setIsAudienceSpinning(false);
    setSelectedPrizeId(null);
    broadcastBus.send({ type: 'CMD_NEXT_DRAW' });
  }, [setSelectedPrizeId]);

  const handleDisqualifyRedraw = useCallback(() => {
    if (!lastRoundId) return;

    const lastEntry = state.drawHistory.find((e) => e.roundId === lastRoundId);
    const targetPrize =
      activeDrawPrize ||
      (lastEntry ? state.prizes.find((p) => p.id === lastEntry.prizeTierId) : null) ||
      currentPrize;

    if (!targetPrize) return;

    setShowDisqualifyModal(false);
    setActiveDrawPrize(targetPrize);
    const nextResult = selectWinner(currentBatch);

    dispatch({
      type: 'DISQUALIFY_WINNER',
      payload: {
        roundId: lastRoundId,
        replacementRoundId: nextResult.roundId,
      },
    });

    setActiveWinner(null);
    setIsAudienceSpinning(true);
    setAdminCountdown(10);

    broadcastBus.send({
      type: 'CMD_DISQUALIFY_REDRAW',
      lastRoundId,
      nextResult,
      prizeTierId: targetPrize.id,
      prizeTierName: targetPrize.title,
      prizeRank: targetPrize.rank,
      prizeImage: targetPrize.imageUrl,
    });

    setTimeout(() => {
      setIsAudienceSpinning(false);
      setActiveWinner(nextResult);
      const auditEntry = createAuditEntry(
        nextResult.winner,
        nextResult.roundId,
        nextResult.seed,
        targetPrize.id,
        targetPrize.title,
        targetPrize.rank
      );
      dispatch({ type: 'RECORD_WIN', payload: auditEntry });
      setLastRoundId(nextResult.roundId);
    }, 11200);
  }, [lastRoundId, activeDrawPrize, currentPrize, state.drawHistory, state.prizes, currentBatch, dispatch]);

  const handleResetEvent = useCallback(() => {
    setShowResetModal(false);
    dispatch({ type: 'RESET_ALL' });
    setImportResult(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping(null);
    setActiveWinner(null);
    setActiveDrawPrize(null);
    setSelectedPrizeId(null);
    setLastRoundId(null);
    setIsAudienceSpinning(false);
    setActiveTab('import');
    broadcastBus.send({ type: 'CMD_RESET' });
  }, [dispatch, setSelectedPrizeId]);

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-paper" />;
  }

  // ─── Lock Screen (If Not Authenticated) ──────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-paper">
        <div className="w-full max-w-xs">
          <img
            src="/logo.png"
            alt="Star Supermarket"
            className="h-14 w-auto object-contain"
          />
          <h1 className="font-display mt-8 text-3xl font-semibold tracking-tight">
            Admin
          </h1>
          <p className="mt-1 text-sm text-muted">
            Enter the PIN to manage entries, prizes and the draw.
          </p>

          <form onSubmit={handlePinSubmit} className="mt-6 space-y-3">
            <div>
              <label htmlFor="admin-pin" className="sr-only">
                PIN
              </label>
              <div className="relative">
                <input
                  id="admin-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError(false);
                  }}
                  placeholder="PIN"
                  autoFocus
                  aria-invalid={pinError}
                  className={`field py-3 pr-10 font-mono text-lg ${
                    pinError ? 'border-brand' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {pinError && (
                <p role="alert" className="mt-2 text-sm text-brand-dark">
                  That PIN is incorrect.
                </p>
              )}
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full">
              Unlock
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted">
            The PIN is 1234 until you change it in Settings.
          </p>

          <Link
            href="/"
            className="mt-8 inline-block text-sm text-muted hover:text-ink underline underline-offset-4 decoration-ink/30 transition-colors"
          >
            Back to the stage
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'import', label: 'Entries' },
    { id: 'prizes', label: 'Prizes' },
    { id: 'draw', label: 'Draw' },
    { id: 'results', label: 'Results' },
    { id: 'settings', label: 'Settings' },
  ];
  const drawnCount = state.prizes.filter((p) => p.isDrawn).length;
  const removeWinners = state.settings.removeWinnerFromPool;
  const tabMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  };

  // ─── Authenticated Admin Dashboard ──────────────────────────
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* ─── Top bar ─────────────────────────────────────────── */}
      <header className="bg-surface border-b border-line sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="Star Supermarket"
              className="h-9 w-auto object-contain"
            />
            <span className="font-display text-lg font-semibold tracking-tight whitespace-nowrap">
              Lucky Draw
            </span>
            <span className="text-sm text-muted">Admin</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <span className="hidden md:flex items-center gap-2 pr-2 text-sm text-muted">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isAudienceConnected ? 'bg-leaf' : 'bg-faint'
                }`}
              />
              {isAudienceConnected ? 'Stage connected' : 'Stage not open'}
            </span>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-line text-sm font-medium hover:border-ink/40 transition-colors"
              title="Open the stage screen in a new tab for the projector"
            >
              <span className="hidden sm:inline">Open stage</span>
              <ExternalLink size={14} />
            </a>

            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              title="Lock admin"
              aria-label="Lock admin"
            >
              <Lock size={16} />
            </button>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-brand text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ─── Content ─────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        <AnimatePresence mode="wait">
          {/* ENTRIES */}
          {activeTab === 'import' && (
            <motion.div key="import" {...tabMotion} className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  Entries
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Upload a CSV or TXT file. Columns are matched automatically
                  and duplicates are removed.
                </p>
              </div>

              <DropZone
                onFileSelect={handleFileSelect}
                isLoading={isImporting}
              />

              {csvHeaders.length > 0 && columnMapping && (
                <>
                  <ColumnMapper
                    headers={csvHeaders}
                    mapping={columnMapping}
                    onMappingChange={handleMappingChange}
                  />

                  {importResult && (
                    <ImportSummary
                      totalRows={importResult.totalRows}
                      eligible={importResult.eligible}
                      duplicates={importResult.duplicates}
                    />
                  )}

                  {importResult && importResult.eligible > 0 && (
                    <>
                      <ParticipantTable
                        participants={
                          processParticipants(csvData, columnMapping).participants
                        }
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="gold"
                          size="lg"
                          onClick={handleConfirmImport}
                        >
                          Use these {importResult.eligible.toLocaleString()}{' '}
                          entries
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}

              {state.participants.length > 0 && csvHeaders.length === 0 && (
                <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {state.participants.length.toLocaleString()} entries loaded
                    </h3>
                    <p className="mt-0.5 text-sm text-muted">
                      Upload another file to replace them.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setActiveTab('prizes')}
                    >
                      Set up prizes
                    </Button>
                    <Button
                      variant="gold"
                      onClick={() => setActiveTab('draw')}
                      disabled={state.prizes.length === 0}
                    >
                      Go to draw
                    </Button>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {/* PRIZES */}
          {activeTab === 'prizes' && (
            <motion.div key="prizes" {...tabMotion} className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  Prizes
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Prizes are drawn from the highest number down to the grand
                  prize at number 1.
                </p>
              </div>

              <PrizeManager
                prizes={state.prizes}
                onUpdate={(prizes) =>
                  dispatch({ type: 'SET_PRIZES', payload: prizes })
                }
              />

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted tabular-nums">
                  {drawnCount} of {state.prizes.length} drawn
                </p>
                <Button
                  variant="gold"
                  size="lg"
                  onClick={() => {
                    dispatch({ type: 'SET_STAGE', payload: 'drawing' });
                    setActiveTab('draw');
                  }}
                  disabled={state.prizes.length === 0}
                >
                  Continue to draw
                </Button>
              </div>
            </motion.div>
          )}

          {/* DRAW */}
          {activeTab === 'draw' && (
            <motion.div key="draw" {...tabMotion} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Current prize and controls */}
                <Card className="lg:col-span-2 p-0">
                  <div className="p-6 flex items-start gap-5">
                    {displayPrize?.imageUrl && (
                      <div className="w-16 h-16 rounded-md border border-line bg-paper p-1.5 flex items-center justify-center shrink-0">
                        <img
                          src={displayPrize.imageUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted">
                        {activeWinner
                          ? 'Just drawn'
                          : isAudienceSpinning
                            ? 'Drawing now'
                            : 'Up next'}
                        {displayPrize && ` · ${rankLabel(displayPrize.rank)}`}
                      </p>
                      <h3 className="font-display mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
                        {displayPrize ? displayPrize.title : 'No prizes yet'}
                      </h3>
                      {displayPrize?.description && (
                        <p className="mt-1 text-sm text-muted">
                          {displayPrize.description}
                        </p>
                      )}
                    </div>
                    {displayPrize && (
                      <Badge
                        variant={displayPrize.isDrawn ? 'winner' : 'default'}
                        className="shrink-0"
                      >
                        {displayPrize.isDrawn ? 'Awarded' : 'Not drawn'}
                      </Badge>
                    )}
                  </div>

                  <div className="px-6 pb-6 space-y-5">
                    {state.prizes.length > 1 && (
                      <div>
                        <label htmlFor="prize-select" className="field-label">
                          Prize to draw
                        </label>
                        <div className="relative">
                          <select
                            id="prize-select"
                            value={displayPrize?.id || ''}
                            onChange={(e) => {
                              setSelectedPrizeId(e.target.value);
                              setActiveDrawPrize(null);
                            }}
                            disabled={isAudienceSpinning || !!activeWinner}
                            className="field appearance-none pr-9 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {state.prizes.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.rank}. {p.title}
                                {p.isDrawn ? ' (awarded)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={16}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="gold"
                        size="lg"
                        icon={<Play size={18} />}
                        onClick={handleTriggerDraw}
                        disabled={!canDraw}
                      >
                        {isAudienceSpinning ? 'Drawing…' : 'Start draw'}
                      </Button>

                      {activeWinner && (
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={handleNextDraw}
                        >
                          Next prize
                        </Button>
                      )}

                      <Button
                        variant="danger"
                        icon={<UserX size={16} />}
                        onClick={() => setShowDisqualifyModal(true)}
                        disabled={!lastRoundId || isAudienceSpinning}
                        className="sm:ml-auto"
                      >
                        Disqualify and redraw
                      </Button>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-line flex flex-wrap items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={removeWinners}
                      onClick={() => dispatch({ type: 'TOGGLE_REMOVE_WINNER' })}
                      className="flex items-center gap-3 text-left cursor-pointer"
                    >
                      <span
                        className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${
                          removeWinners ? 'bg-leaf' : 'bg-ink/20'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            removeWinners ? 'translate-x-4' : ''
                          }`}
                        />
                      </span>
                      Remove winners from the pool
                    </button>

                    <span className="text-muted tabular-nums">
                      {currentBatch.length.toLocaleString()} in this draw ·{' '}
                      {state.participants.length.toLocaleString()} entries
                    </span>
                  </div>
                </Card>

                {/* What the audience sees */}
                <Card className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">On stage</h3>
                    <a
                      href="/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted hover:text-ink underline underline-offset-4 decoration-ink/30 transition-colors"
                    >
                      Open
                    </a>
                  </div>

                  <div className="flex-1 flex flex-col justify-center min-h-[180px] py-6">
                    {isAudienceSpinning ? (
                      <>
                        <p
                          className={`font-display text-6xl font-semibold leading-none tabular-nums ${
                            adminCountdown <= 3 ? 'text-brand' : 'text-ink'
                          }`}
                        >
                          {adminCountdown}
                        </p>
                        <p className="mt-3 text-sm text-muted">
                          Drawing {displayPrize?.title}
                        </p>
                      </>
                    ) : activeWinner ? (
                      <>
                        <p className="text-sm font-medium text-leaf">Winner</p>
                        <p className="font-display mt-1 text-2xl font-semibold tracking-tight break-words">
                          {activeWinner.winner.fullName}
                        </p>
                        {activeWinner.winner.ticketId && (
                          <p className="mt-1 font-mono text-sm text-muted">
                            {activeWinner.winner.ticketId}
                          </p>
                        )}
                        <p className="mt-3 text-sm text-muted">
                          {displayPrize?.title}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-display text-2xl font-semibold tracking-tight text-ink/30">
                          Waiting
                        </p>
                        <p className="mt-2 text-sm text-muted">
                          {displayPrize
                            ? `Next: ${displayPrize.title}`
                            : 'Add prizes to begin.'}
                        </p>
                      </>
                    )}
                  </div>
                </Card>
              </div>

              {state.drawHistory.length > 0 && (
                <DrawHistory history={state.drawHistory} />
              )}
            </motion.div>
          )}

          {/* RESULTS */}
          {activeTab === 'results' && (
            <motion.div key="results" {...tabMotion} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    Results
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Every round is logged with its time, winner and SHA-256
                    hash.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    icon={<Download size={16} />}
                    onClick={() => exportDrawResultsCSV(state.drawHistory)}
                    disabled={state.drawHistory.length === 0}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowResetModal(true)}
                  >
                    Reset event
                  </Button>
                </div>
              </div>

              <DrawHistory history={state.drawHistory} />
            </motion.div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              {...tabMotion}
              className="space-y-6 max-w-xl"
            >
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Settings
              </h2>

              <Card>
                <h3 className="font-semibold">Change PIN</h3>

                <form onSubmit={handlePinChange} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="current-pin" className="field-label">
                      Current PIN
                    </label>
                    <input
                      id="current-pin"
                      type="password"
                      inputMode="numeric"
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value)}
                      className="field font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="new-pin" className="field-label">
                      New PIN{' '}
                      <span className="font-normal text-muted">
                        (at least 4 digits)
                      </span>
                    </label>
                    <input
                      id="new-pin"
                      type="password"
                      inputMode="numeric"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      className="field font-mono"
                    />
                  </div>

                  {pinChangeMessage && (
                    <p
                      role="status"
                      className={`text-sm ${
                        pinChangeMessage.type === 'success'
                          ? 'text-leaf'
                          : 'text-brand-dark'
                      }`}
                    >
                      {pinChangeMessage.text}
                    </p>
                  )}

                  <Button type="submit" variant="primary">
                    Save PIN
                  </Button>
                </form>
              </Card>

              <Card className="border-brand/30">
                <h3 className="font-semibold">Reset event</h3>
                <p className="mt-1 text-sm text-muted">
                  Deletes all entries, prizes and draw history from this
                  browser. This cannot be undone.
                </p>
                <Button
                  variant="danger"
                  icon={<RotateCcw size={14} />}
                  onClick={() => setShowResetModal(true)}
                  className="mt-4"
                >
                  Reset event
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── Disqualify Modal ────────────────────────────────── */}
      <Modal
        open={showDisqualifyModal}
        onClose={() => setShowDisqualifyModal(false)}
        title="Disqualify this winner?"
      >
        <div className="space-y-5">
          <p className="text-sm text-muted">
            A replacement will be drawn for the same prize and shown on the
            stage screen straight away. The disqualification stays in the
            results log.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowDisqualifyModal(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDisqualifyRedraw}>
              Disqualify and redraw
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Reset Confirmation Modal ────────────────────────── */}
      <Modal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset the event?"
      >
        <div className="space-y-5">
          <p className="text-sm text-muted">
            This deletes all entries, prizes and draw history stored in this
            browser. It cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowResetModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleResetEvent}>
              Reset event
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
