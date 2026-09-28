import { useEffect, useState } from 'react';

/**
 * Print-on-demand, the way the payment ledger does it: set a target, the sheet
 * for it mounts, the print dialog opens on the next frame, and the target is
 * cleared once the dialog closes so no stray sheet is left for the next print.
 */
export const usePrintTarget = <T>() => {
  const [target, setTarget] = useState<T | null>(null);

  useEffect(() => {
    if (!target) return;
    const clear = () => setTarget(null);
    window.addEventListener('afterprint', clear);
    // A frame for the sheet to paint before the dialog freezes the page.
    const timer = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', clear);
    };
  }, [target]);

  return [target, setTarget] as const;
};
