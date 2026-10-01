'use client';

import React from 'react';
import type { ColumnMapping } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { ChevronDown } from 'lucide-react';

interface ColumnMapperProps {
  headers: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

function SelectField({
  label,
  value,
  headers,
  required,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {!required && <span className="font-normal text-muted"> (optional)</span>}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field appearance-none pr-9 cursor-pointer"
        >
          {!required && <option value="">Not used</option>}
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
      </span>
    </label>
  );
}

export function ColumnMapper({
  headers,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  return (
    <Card>
      <h3 className="text-sm font-semibold">Columns</h3>
      <p className="mt-0.5 text-sm text-muted">
        Check that each field points at the right column in your file.
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SelectField
          label="Full name"
          value={mapping.fullName}
          headers={headers}
          required
          onChange={(v) => onMappingChange({ ...mapping, fullName: v })}
        />
        <SelectField
          label="Email or phone"
          value={mapping.identifier || ''}
          headers={headers}
          onChange={(v) =>
            onMappingChange({ ...mapping, identifier: v || undefined })
          }
        />
        <SelectField
          label="Ticket ID"
          value={mapping.ticketId || ''}
          headers={headers}
          onChange={(v) =>
            onMappingChange({ ...mapping, ticketId: v || undefined })
          }
        />
      </div>
    </Card>
  );
}
