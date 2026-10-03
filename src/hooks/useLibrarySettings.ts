import { useQuery } from "@tanstack/react-query";
import { apiSettings } from "@/api";
import { qk } from "@/api/queryKeys";
import { fmtDays, fmtHours } from "@/lib/time";
import type { LibraryRules } from "@/types";

/** The original rules: what the logic assumes until the real ones arrive (or when they cannot be fetched). */
export const DEFAULT_RULES: LibraryRules = { holdHours: 48, loanDays: 14, maxRenewals: 1, renewWindowDays: 3 };

/**
 * The circulation rules (hold hours, loan days, renewals), as an admin last set them. Every sentence in the
 * interface that quotes a number takes it from here. Admins also receive the borrow limits in `data`.
 */
export function useLibrarySettings() {
  const query = useQuery({ queryKey: qk.settings, queryFn: apiSettings.get, staleTime: 5 * 60_000 });
  const rules: LibraryRules = query.data ?? DEFAULT_RULES;
  // `ready`: the rules are the stored ones, or fetching failed and the defaults are the best that can be said.
  return { ...query, rules, ready: query.data !== undefined || query.isError };
}

/** `{hours}` and `{days}` for the interface copy, written out in the active language ("48 hours", "14 days"). */
export function useRuleVars() {
  const { rules, ready } = useLibrarySettings();
  // Until the rules arrive an ellipsis stands in, so a number that is about to change is never shown.
  if (!ready) return { hours: "…", days: "…" };
  return { hours: fmtHours(rules.holdHours), days: fmtDays(rules.loanDays) };
}
