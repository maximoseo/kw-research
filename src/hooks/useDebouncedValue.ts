'use client';

import { useEffect, useState } from 'react';

/**
 * Debounces a value by the specified delay.
 * The returned value only updates after the input has stopped changing for `delay` ms.
 *
 * UI tip: Use the raw input value for the <input> itself (instant feedback),
 * and the debounced value for expensive work (API calls, table filtering, etc.).
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
