import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { formatCountdown, toMs } from "@/lib/time";

/** Live countdown to a deadline. */
export function Countdown({ deadline, className }: { deadline: string | number; className?: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = (toMs(deadline) ?? 0) - now;
  if (left <= 0) return <span className="font-semibold text-danger">{t("time.expired")}</span>;
  return <span dir="ltr" className={className ?? "tabular font-medium"}>{formatCountdown(left)}</span>;
}
