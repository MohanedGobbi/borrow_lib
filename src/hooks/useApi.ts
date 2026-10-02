import { useCallback, useEffect, useRef, useState } from "react";

/** Generic async data hook: fetches on mount + exposes refetch. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seqRef = useRef(0);

  const refetch = useCallback(async () => {
    // Only the latest request may update state, so a slow earlier response cannot overwrite a newer one.
    const seq = ++seqRef.current;
    try {
      const result = await fnRef.current();
      if (seq !== seqRef.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refetch();
    if (pollMs) {
      const t = window.setInterval(refetch, pollMs);
      return () => window.clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch };
}
