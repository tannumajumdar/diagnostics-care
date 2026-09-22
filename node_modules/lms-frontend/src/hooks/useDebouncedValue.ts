import { useEffect, useState } from 'react';

/**
 * Holds a value still until the user stops changing it.
 *
 * Typed searches that go to the server need this: a receptionist typing
 * "haemoglobin" fires eleven requests without it, and the answers come back
 * out of order so the list flickers between matches for "hae" and "haemo".
 * The debounced value only moves once the typing pauses.
 */
export const useDebouncedValue = <T,>(value: T, delayMs = 250): T => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
};
