'use client';

import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export function DropZone({ onFileSelect, isLoading }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      const validTypes = [
        'text/csv',
        'text/plain',
        'application/vnd.ms-excel',
      ];
      const validExtensions = ['.csv', '.txt'];

      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (
        !validTypes.includes(file.type) &&
        !validExtensions.includes(extension)
      ) {
        setError('Please upload a CSV or TXT file');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB');
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div className="space-y-3">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center text-center
          w-full min-h-[180px] px-6 rounded-lg border border-dashed
          cursor-pointer transition-colors
          ${isDragging ? 'border-brand bg-brand-tint/50' : 'border-ink/25 bg-surface hover:border-ink/50'}
          ${isLoading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          type="file"
          accept=".csv,.txt"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={handleFileInput}
          disabled={isLoading}
        />
        <Upload size={20} className="text-muted" />
        <p className="mt-3 text-sm font-medium">
          {isLoading
            ? 'Reading file…'
            : isDragging
            ? 'Drop to upload'
            : 'Drop a CSV here, or click to choose a file'}
        </p>
        <p className="mt-1 text-xs text-muted">CSV or TXT, up to 10 MB</p>
      </label>

      {error && (
        <p role="alert" className="text-sm text-brand-dark">
          {error}
        </p>
      )}
    </div>
  );
}
