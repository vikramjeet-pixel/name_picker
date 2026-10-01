'use client';

import { useEffect } from 'react';

interface KeyboardShortcuts {
  onSpace?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcut handler for draw controls.
 * Space = trigger/stop draw, Escape = exit fullscreen.
 */
export function useKeyboardShortcuts({
  onSpace,
  onEscape,
  enabled = true,
}: KeyboardShortcuts) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onSpace?.();
          break;
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSpace, onEscape, enabled]);
}
