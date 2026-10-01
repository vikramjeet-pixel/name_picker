'use client';

import React, { useState, useRef } from 'react';
import type { PrizeItem } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  RotateCcw,
  Check,
  Image as ImageIcon,
  Edit2,
} from 'lucide-react';
import {
  create10TierLadder,
  create15TierLadder,
  rankLabel,
  PRIZE_ICONS,
} from '@/lib/prize-presets';

interface PrizeManagerProps {
  prizes: PrizeItem[];
  onUpdate: (prizes: PrizeItem[]) => void;
}

export function PrizeManager({ prizes, onUpdate }: PrizeManagerProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newRank, setNewRank] = useState<number>(() =>
    prizes.length > 0 ? Math.max(...prizes.map((p) => p.rank)) + 1 : 1
  );
  const [newDesc, setNewDesc] = useState('');
  const [newImage, setNewImage] = useState<string>(PRIZE_ICONS.trophy);
  const [selectedPreset, setSelectedPreset] = useState<string>('trophy');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRank, setEditRank] = useState<number>(1);
  const [editImage, setEditImage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // File Upload Handlers (converts image to Data URL)
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 3MB for base64 storage)
    if (file.size > 3 * 1024 * 1024) {
      alert('Image size should be under 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (isEdit) {
        setEditImage(dataUrl);
      } else {
        setNewImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddPrize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    const id = `prize-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const rankNum = Number(newRank) || (prizes.length + 1);

    const newPrize: PrizeItem = {
      id,
      rank: Math.max(1, Math.min(15, rankNum)),
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      imageUrl: newImage || PRIZE_ICONS.gift,
      isDrawn: false,
    };

    const updated = [...prizes, newPrize].sort((a, b) => a.rank - b.rank);
    onUpdate(updated);

    // Reset form
    setNewTitle('');
    setNewDesc('');
    setNewRank(updated.length + 1);
    setNewImage(PRIZE_ICONS.trophy);
    setSelectedPreset('trophy');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = (prize: PrizeItem) => {
    setEditingId(prize.id);
    setEditTitle(prize.title);
    setEditDesc(prize.description || '');
    setEditRank(prize.rank);
    setEditImage(prize.imageUrl);
  };

  const saveEdit = (id: string) => {
    const updated = prizes
      .map((p) => {
        if (p.id === id) {
          return {
            ...p,
            title: editTitle.trim() || p.title,
            description: editDesc.trim() || undefined,
            rank: Math.max(1, Math.min(15, Number(editRank) || p.rank)),
            imageUrl: editImage || p.imageUrl,
          };
        }
        return p;
      })
      .sort((a, b) => a.rank - b.rank);

    onUpdate(updated);
    setEditingId(null);
  };

  const removePrize = (id: string) => {
    onUpdate(prizes.filter((p) => p.id !== id));
  };

  const resetDrawStatus = (id?: string) => {
    const updated = prizes.map((p) => {
      if (!id || p.id === id) {
        return {
          ...p,
          isDrawn: false,
          winner: undefined,
        };
      }
      return p;
    });
    onUpdate(updated);
  };

  const movePrizeRank = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= prizes.length) return;

    const copy = [...prizes];
    // Swap ranks
    const tempRank = copy[index].rank;
    copy[index].rank = copy[newIndex].rank;
    copy[newIndex].rank = tempRank;

    copy.sort((a, b) => a.rank - b.rank);
    onUpdate(copy);
  };

  const iconButton =
    'p-1.5 rounded-md text-muted hover:text-ink hover:bg-ink/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer';

  return (
    <div className="space-y-8">
      {/* ─── Templates ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Start from a template:</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onUpdate(create10TierLadder())}
        >
          10 prizes
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onUpdate(create15TierLadder())}
        >
          15 prizes
        </Button>

        {prizes.some((p) => p.isDrawn) && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw size={14} />}
            onClick={() => resetDrawStatus()}
            className="ml-auto"
          >
            Clear all winners
          </Button>
        )}
      </div>

      {/* ─── Add a prize ─────────────────────────────────────── */}
      <Card>
        <h3 className="text-sm font-semibold">Add a prize</h3>

        <form onSubmit={handleAddPrize} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="prize-rank" className="field-label">
                Rank
              </label>
              <input
                id="prize-rank"
                type="number"
                min={1}
                max={15}
                value={newRank}
                onChange={(e) => setNewRank(parseInt(e.target.value) || 1)}
                className="field font-mono"
              />
            </div>

            <div className="md:col-span-6">
              <label htmlFor="prize-title" className="field-label">
                Title
              </label>
              <input
                id="prize-title"
                type="text"
                placeholder="e.g. $500 grocery gift card"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="field"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="prize-desc" className="field-label">
                Description{' '}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="prize-desc"
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="field"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="w-12 h-12 rounded-md border border-line bg-paper p-1.5 flex items-center justify-center shrink-0">
              <img
                src={newImage || PRIZE_ICONS.trophy}
                alt="Selected prize image"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {Object.entries(PRIZE_ICONS).map(([key, iconUrl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(key);
                    setNewImage(iconUrl);
                  }}
                  className={`w-8 h-8 rounded-md border p-1 transition-colors cursor-pointer ${
                    selectedPreset === key && newImage === iconUrl
                      ? 'border-ink bg-paper'
                      : 'border-line hover:border-ink/40'
                  }`}
                  title={key}
                  aria-label={`Use ${key} icon`}
                >
                  <img
                    src={iconUrl}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={(e) => handleImageUpload(e, false)}
              className="hidden"
              id="prize-image-upload"
            />
            <label
              htmlFor="prize-image-upload"
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 decoration-ink/30 hover:decoration-ink cursor-pointer"
            >
              <Upload size={14} />
              Upload a photo
            </label>

            <div className="ml-auto">
              <Button type="submit" variant="gold" icon={<Plus size={16} />}>
                Add prize
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* ─── Prize list ──────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between pb-2 border-b-2 border-ink">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Prize list
          </h3>
          <span className="text-sm text-muted">
            {prizes.length} {prizes.length === 1 ? 'prize' : 'prizes'}
          </span>
        </div>

        {prizes.length === 0 ? (
          <p className="py-10 text-sm text-muted">
            No prizes yet. Load a template or add your own above.
          </p>
        ) : (
          <ul>
            {prizes.map((prize, idx) => {
              if (editingId === prize.id) {
                return (
                  <li
                    key={prize.id}
                    className="py-4 border-b border-line space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-2">
                        <label className="field-label">Rank</label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={editRank}
                          onChange={(e) =>
                            setEditRank(parseInt(e.target.value) || 1)
                          }
                          className="field font-mono"
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <label className="field-label">Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="field"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="field-label">Description</label>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="field"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {editImage && (
                          <img
                            src={editImage}
                            alt=""
                            className="w-9 h-9 object-contain"
                          />
                        )}
                        <input
                          type="file"
                          ref={editFileInputRef}
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, true)}
                          className="hidden"
                          id={`edit-file-${prize.id}`}
                        />
                        <label
                          htmlFor={`edit-file-${prize.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 decoration-ink/30 hover:decoration-ink cursor-pointer"
                        >
                          <Upload size={14} />
                          Change photo
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => saveEdit(prize.id)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={prize.id}
                  className="flex items-center gap-3 sm:gap-4 py-3 border-b border-line"
                >
                  <span className="w-6 shrink-0 font-mono text-sm text-muted tabular-nums">
                    {String(prize.rank).padStart(2, '0')}
                  </span>

                  <div className="w-11 h-11 rounded-md border border-line bg-surface p-1 flex items-center justify-center shrink-0">
                    {prize.imageUrl ? (
                      <img
                        src={prize.imageUrl}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon size={18} className="text-faint" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium truncate">
                        {prize.title}
                      </h4>
                      {prize.rank === 1 && (
                        <Badge className="shrink-0">{rankLabel(1)}</Badge>
                      )}
                    </div>

                    {prize.isDrawn && prize.winner ? (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-leaf truncate">
                        <Check size={13} className="shrink-0" />
                        <span className="truncate">
                          {prize.winner.name}
                          {prize.winner.identifier && (
                            <span className="ml-2 font-mono text-xs text-muted">
                              {prize.winner.identifier}
                            </span>
                          )}
                        </span>
                      </p>
                    ) : (
                      prize.description && (
                        <p className="mt-0.5 text-sm text-muted truncate">
                          {prize.description}
                        </p>
                      )
                    )}
                  </div>

                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => movePrizeRank(idx, -1)}
                      disabled={idx === 0}
                      className={iconButton}
                      title="Move up"
                      aria-label="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => movePrizeRank(idx, 1)}
                      disabled={idx === prizes.length - 1}
                      className={iconButton}
                      title="Move down"
                      aria-label="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      onClick={() => startEdit(prize)}
                      className={iconButton}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    {prize.isDrawn && (
                      <button
                        onClick={() => resetDrawStatus(prize.id)}
                        className={iconButton}
                        title="Clear winner"
                        aria-label="Clear winner"
                      >
                        <RotateCcw size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => removePrize(prize.id)}
                      className={`${iconButton} hover:text-brand-dark`}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
