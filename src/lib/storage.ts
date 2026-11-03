import { useCallback, useState } from "react";

// A state that persists in `localStorage` under `ihf:<key>`.
export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const storageKey = `ihf:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // storage is not available or the value is invalid
    }
    return initial;
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(storageKey, JSON.stringify(v));
      } catch {
        // storage is not available
      }
    },
    [storageKey],
  );
  return [value, set];
}
