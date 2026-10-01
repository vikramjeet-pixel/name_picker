'use client';

import React, { useState, useMemo } from 'react';
import type { Participant } from '@/lib/types';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface ParticipantTableProps {
  participants: Participant[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const th = 'px-3 py-2 text-left text-xs font-medium text-muted';
const pagerButton =
  'p-1.5 rounded-md text-muted hover:text-ink hover:bg-ink/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer';

export function ParticipantTable({ participants }: ParticipantTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    if (!search.trim()) return participants;
    const q = search.toLowerCase();
    return participants.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.identifier?.toLowerCase().includes(q) ||
        p.ticketId?.toLowerCase().includes(q)
    );
  }, [participants, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  return (
    <div>
      {/* Search & Page Size */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between pb-3 border-b-2 border-ink">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            placeholder="Search entries"
            aria-label="Search entries"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="field pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={`${th} w-12`}>#</th>
              <th className={th}>Name</th>
              <th className={th}>Email or phone</th>
              <th className={th}>Ticket ID</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-muted">
                  {search ? 'No entries match that search.' : 'No entries loaded.'}
                </td>
              </tr>
            ) : (
              pageData.map((p, i) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="px-3 py-2.5 font-mono text-xs text-muted tabular-nums">
                    {start + i + 1}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{p.fullName}</td>
                  <td className="px-3 py-2.5 text-muted">
                    {p.identifier || '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted">
                    {p.ticketId || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-3 text-sm text-muted tabular-nums">
        <span>
          {filtered.length === 0 ? 0 : start + 1}–
          {Math.min(start + pageSize, filtered.length)} of{' '}
          {filtered.length.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-label="Previous page"
            className={pagerButton}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-2">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Next page"
            className={pagerButton}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
