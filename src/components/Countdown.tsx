import { useEffect, useState } from "react";

function toMs(ts: string | number | null | undefined): number | null {
  if (ts == null) return null;
  return typeof ts === "number" ? ts : new Date(ts).getTime();
}

function format(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/** Live countdown to a deadline; shows EXPIRED when past. */
export function Countdown({ deadline }: { deadline: string | number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = (toMs(deadline) ?? 0) - now;
  if (left <= 0) return <span className="font-mono text-danger font-semibold">EXPIRED</span>;
  return <span className="font-mono tabular-nums">{format(left)}</span>;
}

export function timeAgo(ts: string | number): string {
  const ms = toMs(ts);
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtDate(ts: string | number | null): string {
  const ms = toMs(ts);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function msLeft(ts: string | number | null): number {
  const ms = toMs(ts);
  return ms == null ? Infinity : ms - Date.now();
}
