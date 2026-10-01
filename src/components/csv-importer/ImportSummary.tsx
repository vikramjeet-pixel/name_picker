'use client';

import React from 'react';

interface ImportSummaryProps {
  totalRows: number;
  eligible: number;
  duplicates: number;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4 first:pl-0">
      <dd className="font-display text-3xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString()}
      </dd>
      <dt className="mt-0.5 text-sm text-muted">{label}</dt>
    </div>
  );
}

export function ImportSummary({ totalRows, eligible, duplicates }: ImportSummaryProps) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-line border-y border-line">
      <Metric label="Rows in file" value={totalRows} />
      <Metric label="Eligible entries" value={eligible} />
      <Metric label="Duplicates removed" value={duplicates} />
    </dl>
  );
}
