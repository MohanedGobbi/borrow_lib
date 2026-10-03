import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { formatCountdown, isClockCountdown, toMs } from "@/lib/time";

/**
 * Live countdown to a deadline. The HH:MM:SS form is digits only, so it stays left-to-right; the
 * "1d 15h" form carries unit words and follows the page direction (days before hours in Arabic).
 */
export function Countdown({ deadline, className }: { deadline: string | number; className?: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = (toMs(deadline) ?? 0) - now;
  if (left <= 0) return <span className="font-semibold text-danger">{t("time.expired")}</span>;
  return <span dir={isClockCountdown(left) ? "ltr" : undefined} className={className ?? "tabular font-medium"}>{formatCountdown(left)}</span>;
}
