'use client';

import { useState, useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Persist state to localStorage with debounced writes.
 * SSR-safe: returns defaultValue on the server.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  debounceMs = 500
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Corrupted data — use default
    }
    return defaultValue;
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save to localStorage
  const setAndPersist = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof newValue === 'function'
            ? (newValue as (prev: T) => T)(prev)
            : newValue;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          try {
            localStorage.setItem(key, JSON.stringify(resolved));
          } catch {
            // Storage full or unavailable
          }
        }, debounceMs);

        return resolved;
      });
    },
    [key, debounceMs]
  );

  return [value, setAndPersist, hydrated];
}
