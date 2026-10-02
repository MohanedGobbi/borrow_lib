import { ApiError } from "@/api/client";
import { hasKey } from "@/i18n";
import { fmtDate } from "@/lib/time";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Turn API params into placeholder values: ISO dates are formatted for the active language. */
function toVars(params: Record<string, unknown> | undefined): Record<string, string | number> {
  const vars: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === "dueDate" && typeof value === "string") vars[key] = fmtDate(value);
    else if (typeof value === "number") vars[key] = value;
    else if (value != null) vars[key] = String(value);
  }
  return vars;
}

/** Translate `prefix.code` with its params, or return null when there is no such translation. */
export function translateCode(
  t: T, prefix: "err" | "notif", code: string | undefined, params?: Record<string, unknown>,
): string | null {
  const key = code ? `${prefix}.${code}` : "";
  if (!key || !hasKey(key)) return null;
  const vars = toVars(params);
  const missing = [...t(key).matchAll(/\{(\w+)\}/g)].some((m) => !(m[1] in vars));
  return missing ? null : t(key, vars); // a param the server did not send: let the next fallback answer
}

const STATUS_CODES: Record<number, string> = {
  0: "network", 401: "not_authenticated", 403: "permission_denied", 404: "not_found", 429: "too_many",
};

// DRF's blank-field code reads the same as "required".
const FIELD_ALIASES: Record<string, string> = { blank: "required" };

/** The text to show for an error: the API's code, then the first known field code, then the status, then the fallback. */
export function errorMessage(t: T, e: unknown, fallbackKey = "toast.failed"): string {
  if (!(e instanceof ApiError)) return t(fallbackKey);

  const fromFields = () => {
    for (const raw of Object.values(e.fieldCodes ?? {}).flat()) {
      const text = translateCode(t, "err", FIELD_ALIASES[raw] ?? raw);
      if (text) return text;
    }
    return null;
  };

  // A validation error is better explained by its field codes than by the generic "invalid".
  const text =
    (e.code === "invalid" ? fromFields() : null) ??
    translateCode(t, "err", e.code, e.params) ??
    fromFields() ??
    translateCode(t, "err", STATUS_CODES[e.status] ?? (e.status >= 500 ? "server" : undefined));
  return text ?? t(fallbackKey);
}

/** A notification in the active language; rows from before codes existed keep their English text. */
export function notificationText(t: T, n: { code?: string; params?: Record<string, unknown>; message: string }): string {
  return translateCode(t, "notif", n.code, n.params) ?? n.message;
}
