import { BookOpen, BookX, Library, ShieldCheck, type LucideIcon } from "lucide-react";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/i18n";
import type { DemoAccountKey } from "@/types";

const ICONS: Record<DemoAccountKey, LucideIcon> = { reader: BookOpen, overdue: BookX, librarian: Library, admin: ShieldCheck };

/** The hosted demo's shared accounts on the sign-in page: one click signs in with that role. */
export function DemoAccounts({ onPick, busy }: { onPick: (email: string, password: string) => void; busy: boolean }) {
  const demo = useDemo();
  const { t } = useI18n();
  if (!demo) return null;
  return (
    <section aria-labelledby="demo-accounts" className="mt-8 rounded-lg border border-brand/25 bg-brand-soft/60 p-4">
      <h2 id="demo-accounts" className="font-medium text-brand-dark">{t("demo.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("demo.sub")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {demo.accounts.map((a) => {
          const Icon = ICONS[a.key];
          return (
            <button
              key={a.key}
              type="button"
              disabled={busy}
              onClick={() => onPick(a.email, demo.password)}
              className="flex items-center gap-3 rounded-md border bg-white px-3 py-2.5 text-start text-sm transition-colors hover:border-brand/50 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              <Icon className="size-5 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{t(`demo.as.${a.key}`)}</span>
                <span className="block truncate text-muted-foreground" dir="ltr">{a.email}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("demo.password")}{" "}<bdi dir="ltr" className="font-mono">{demo.password}</bdi>
      </p>
    </section>
  );
}
