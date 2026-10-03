import { LOCALES, type Lang } from "@/i18n/locales";

export function toMs(ts: string | number | null | undefined): number | null {
  if (ts == null) return null;
  return typeof ts === "number" ? ts : new Date(ts).getTime();
}

/** Locale of the active UI language (the i18n provider keeps <html lang> in sync). */
function locale(): string {
  const lang = document.documentElement.lang as Lang;
  return LOCALES[lang] ?? "en-GB";
}

function unit(value: number, u: "day" | "hour") {
  return new Intl.NumberFormat(locale(), { style: "unit", unit: u, unitDisplay: "narrow" }).format(value);
}

/** True for the digits-only HH:MM:SS form (under a day). Longer ones carry unit words and read in the page direction. */
export function isClockCountdown(ms: number): boolean {
  return Math.floor(ms / 3_600_000) < 24;
}

export function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (!isClockCountdown(ms)) return `${unit(Math.floor(h / 24), "day")} ${unit(h % 24, "hour")}`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function longUnit(value: number, u: "day" | "hour") {
  return new Intl.NumberFormat(locale(), { style: "unit", unit: u, unitDisplay: "long" }).format(value);
}

/** "48 hours", "1 hour", "٢٤ ساعة": a length of time for sentences, in the active language. */
export const fmtHours = (n: number) => longUnit(n, "hour");
/** "14 days", "1 day". */
export const fmtDays = (n: number) => longUnit(n, "day");

export function timeAgo(ts: string | number): string {
  const ms = toMs(ts);
  if (ms == null) return "—";
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto", style: "short" });
  const minutes = Math.round((ms - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function fmtDate(ts: string | number | null): string {
  const ms = toMs(ts);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(ts: string | number | null): string {
  const ms = toMs(ts);
  if (ms == null) return "—";
  return new Date(ms).toLocaleString(locale(), {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** "3 Oct, 09:12 · 2 days ago": the exact moment and how long ago it was. */
export function fmtDateTimeAgo(ts: string | number | null): string {
  if (ts == null) return "—";
  return `${fmtDateTime(ts)} · ${timeAgo(ts)}`;
}

export function msLeft(ts: string | number | null): number {
  const ms = toMs(ts);
  return ms == null ? Infinity : ms - Date.now();
}

/** Days until a timestamp, rounded up (1.2 days left → 2); whole days since it when past (5.3 days ago → -5). */
export function daysFrom(ts: string | number | null): number {
  const left = msLeft(ts);
  if (!Number.isFinite(left)) return 0;
  const days = left / 86_400_000;
  return days >= 0 ? Math.ceil(days) : Math.trunc(days);
}

/**
 * An ISO timestamp `aheadMs` from now, rounded up to the next full hour. Used as a server filter ("due within
 * 3 days") so the query key changes once an hour instead of on every render.
 */
export function hourCutoff(aheadMs: number): string {
  const hour = 3_600_000;
  return new Date(Math.ceil(Date.now() / hour) * hour + aheadMs).toISOString();
}
