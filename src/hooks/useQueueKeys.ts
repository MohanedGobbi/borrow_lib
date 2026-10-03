import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

// Open overlays that own the keyboard. A hidden listbox (the desk search keeps its list in the page) does not count.
const BLOCKING = "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']:not([hidden])";

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Keyboard work on a desk queue (Approvals, Pickups).
 *
 * J and K move a real focus from row to row; the row with focus is `aria-selected`. The other keys act on the
 * row that has focus (or holds an element that has): `onKey` gets the key and the row, and returns true when it
 * used the key. Enter on the row itself calls `onOpen`. Nothing happens while an input, a dialog or a menu has
 * focus, or with a modifier key held, so typing in the filter or in the reject dialog is never intercepted.
 *
 * When the focused row disappears (its action finished and the list refreshed) focus goes to the row that took
 * its place, or to the panel heading when it was the last one, never to the page body.
 */
export function useQueueKeys<T extends { id: number }>({
  rows, onKey, onOpen,
}: {
  rows: T[];
  onKey: (key: string, row: T) => boolean | void;
  onOpen: (row: T) => void;
}) {
  const container = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // The same as selectedId, for the logic that must not wait for a render (and may not set state in an effect).
  const focusedId = useRef<number | null>(null);
  const latest = useRef({ rows, onKey, onOpen });
  const previousIds = useRef<number[]>([]);

  useEffect(() => {
    latest.current = { rows, onKey, onOpen };
  });

  const rowEl = useCallback((id: number) =>
    container.current?.querySelector<HTMLElement>(`[data-row-id="${id}"]`) ?? null, []);

  useEffect(() => {
    const onDocKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditable(e.target) || document.querySelector(BLOCKING)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const { rows, onKey, onOpen } = latest.current;
      const target = e.target instanceof Element ? e.target : null;
      const inside = target?.closest<HTMLElement>("[data-row-id]") ?? null;
      const current = inside && container.current?.contains(inside) ? rows.find((r) => String(r.id) === inside.dataset.rowId) : undefined;

      if (key === "j" || key === "k") {
        if (!rows.length) return;
        const at = current ? rows.indexOf(current) : -1;
        const next = key === "j" ? Math.min(rows.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
        e.preventDefault();
        rowEl(rows[next].id)?.focus();
        return;
      }
      if (!current) return;
      if (key === "Enter") {
        // Enter on a button or link inside the row keeps its own meaning.
        if (target !== inside) return;
        e.preventDefault();
        onOpen(current);
      } else if (key.length === 1 && onKey(key, current)) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onDocKey);
    return () => document.removeEventListener("keydown", onDocKey);
  }, [rowEl]);

  // A row that had focus is gone: hand the focus to its neighbour, or to the heading.
  useEffect(() => {
    const ids = rows.map((r) => r.id);
    const before = previousIds.current;
    previousIds.current = ids;
    const gone = focusedId.current;
    if (gone === null || ids.includes(gone)) return;
    focusedId.current = null;
    const focusLost = !document.activeElement || document.activeElement === document.body;
    if (!focusLost) return; // the user already moved on
    const was = before.indexOf(gone);
    const nextId = was >= 0 ? ids.find((id) => before.indexOf(id) > was) ?? null : null;
    if (nextId !== null) rowEl(nextId)?.focus();
    else heading.current?.focus();
  }, [rows, rowEl]);

  // Focus inside a row selects it; focus leaving the list for somewhere else clears the selection.
  const onFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    const row = (e.target as Element).closest<HTMLElement>("[data-row-id]");
    if (row?.dataset.rowId) {
      focusedId.current = Number(row.dataset.rowId);
      setSelectedId(focusedId.current);
    }
  }, []);
  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !e.currentTarget.contains(to)) {
      focusedId.current = null;
      setSelectedId(null);
    }
  }, []);

  return {
    /** Spread on the `<tbody>`: lets the hook find the rows and follow the focus. */
    bodyProps: {
      ref: (el: HTMLElement | null) => { container.current = el; },
      onFocus,
      onBlur,
    },
    /** Spread on each `<tr>`. */
    rowProps: (id: number) => ({
      "data-row-id": id,
      tabIndex: -1,
      "aria-selected": selectedId === id,
    }),
    /** Pass to the Panel as `headingRef`. */
    headingRef: heading,
    selectedId,
  };
}
