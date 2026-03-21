import { useEffect, useState } from 'react';

/** Hodnota se po `delayMs` synchronizuje s `value` — vhodné pro live hledání bez zahlcení API. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
