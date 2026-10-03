import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateCirculation } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";

/** How long staff can undo a confirmed pickup or return before the request is really sent. */
export const UNDO_MS = 8000;

type Commit = (opts: { keepalive: boolean }) => Promise<unknown>;

interface Entry {
  id: number;
  /** `waiting`: the undo window is open, nothing was sent. `sending`: the request is on its way. */
  phase: "waiting" | "sending";
  commit: Commit;
  toastId: string;
  timer: number;
  done: Promise<void>;
  /** Send now. `keepalive` lets the request outlive a closing page. */
  send: (keepalive: boolean) => void;
}

/** Every action still waiting, across all hook instances, so sign-out and pagehide can flush them. */
const live = new Set<Entry>();

/** Sends every waiting action now and resolves when all requests have finished. Sign-out calls this first. */
export async function flushDeferredActions(): Promise<void> {
  const all = [...live];
  for (const entry of all) if (entry.phase === "waiting") entry.send(false);
  await Promise.all(all.map((entry) => entry.done));
}

// A closing tab cannot wait for a timer: send what is waiting with `keepalive`, so the request (and its
// Authorization header) still goes out after the page is gone.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const entry of [...live]) if (entry.phase === "waiting") entry.send(true);
  });
}

export type DeferredPhase = "waiting" | "sending" | null;

/**
 * Confirm-pickup and confirm-return with an 8-second Undo. The click only marks the row and shows a toast;
 * the API call is sent when the window ends. It is sent at once when the page unmounts, when the tab closes
 * (`pagehide`), when the user signs out, or when the same row gets another action. Undo sends nothing.
 *
 * After a successful call the circulation data is invalidated; after a failure the error is shown and the
 * row is put back.
 */
export function useDeferredAction() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const entries = useRef(new Map<number, Entry>());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const tRef = useRef(t);
  const qcRef = useRef<QueryClient>(qc);
  useEffect(() => {
    tRef.current = t;
    qcRef.current = qc;
  });

  const undo = useCallback((id: number) => {
    const entry = entries.current.get(id);
    if (!entry || entry.phase !== "waiting") return;
    window.clearTimeout(entry.timer);
    toast.dismiss(entry.toastId);
    live.delete(entry);
    entries.current.delete(id);
    rerender();
  }, []);

  const schedule = useCallback(
    (id: number, message: string, commit: Commit) => {
      const previous = entries.current.get(id);
      if (previous?.phase === "waiting") previous.send(false); // a second action on the row: the first goes now
      const after = previous?.done ?? Promise.resolve();

      const toastId = `deferred-${id}-${Date.now()}`;
      const entry = { id, phase: "waiting", commit, toastId } as Entry;

      entry.send = (keepalive) => {
        if (entry.phase !== "waiting") return;
        window.clearTimeout(entry.timer);
        entry.phase = "sending";
        toast.dismiss(toastId);
        rerender();
        entry.done = (async () => {
          try {
            await after;
            await commit({ keepalive });
            if (!keepalive) await invalidateCirculation(qcRef.current);
          } catch (e) {
            toast.error(errorMessage(tRef.current, e));
          } finally {
            live.delete(entry);
            if (entries.current.get(id) === entry) entries.current.delete(id);
            rerender();
          }
        })();
      };

      entry.done = Promise.resolve();
      entry.timer = window.setTimeout(() => entry.send(false), UNDO_MS);
      entries.current.set(id, entry);
      live.add(entry);
      rerender();

      toast.success(message, {
        id: toastId,
        duration: UNDO_MS,
        action: { label: tRef.current("common.undo"), onClick: () => undo(id) },
      });
    },
    [undo],
  );

  // Leaving the page (route change) sends whatever is still waiting.
  useEffect(() => {
    const own = entries.current;
    return () => {
      for (const entry of own.values()) if (entry.phase === "waiting") entry.send(false);
    };
  }, []);

  const phaseOf = (id: number): DeferredPhase => entries.current.get(id)?.phase ?? null;
  return { schedule, undo, phaseOf };
}
