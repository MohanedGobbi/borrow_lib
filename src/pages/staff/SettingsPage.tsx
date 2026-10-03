import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiSettings } from "@/api";
import { invalidateSettings, qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { fmtDateTime, fmtDays, fmtHours } from "@/lib/time";
import { ErrorState, PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { SitePhotosSection } from "@/components/SitePhotosSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LibraryRules, LibrarySettings, SettingsPatch } from "@/types";

type Field = keyof SettingsPatch;

/** The six rules and their bounds, the same as the server enforces (LibrarySettingsSerializer). */
const FIELDS: { key: Field; min: number; max: number }[] = [
  { key: "holdHours", min: 1, max: 168 },
  { key: "loanDays", min: 1, max: 90 },
  { key: "maxRenewals", min: 0, max: 5 },
  { key: "memberBorrowLimit", min: 1, max: 50 },
  { key: "staffBorrowLimit", min: 1, max: 50 },
  { key: "reminderDaysBeforeDue", min: 0, max: 14 },
];

const isAdminView = (s: LibraryRules | LibrarySettings | undefined): s is LibrarySettings =>
  !!s && "memberBorrowLimit" in s;

const fromSettings = (s: LibrarySettings) =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, String(s[key])])) as Record<Field, string>;

/** Admin-only: the circulation rules (hold hours, loan days, renewals, borrow limits, reminder lead time). */
export default function SettingsPage() {
  const { t } = useI18n();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: qk.settings, queryFn: apiSettings.get, staleTime: 0, refetchOnMount: "always",
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.settings")} description={t("settings.sub")} />
      {isPending ? (
        <Panel flush><RowsSkeleton rows={6} /></Panel>
      ) : isError || !isAdminView(data) ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          {/* A new copy of the form whenever the saved rules change, so the fields start from what is stored. */}
          <SettingsForm key={data.updatedAt} settings={data} />
          <SitePhotosSection />
        </>
      )}
    </div>
  );
}

function SettingsForm({ settings }: { settings: LibrarySettings }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<Field, string>>(() => fromSettings(settings));
  const [confirming, setConfirming] = useState(false);

  const parsed = (key: Field, min: number, max: number): number | null => {
    const raw = draft[key].trim();
    if (!/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return n >= min && n <= max ? n : null;
  };
  const invalid = new Set(FIELDS.filter(({ key, min, max }) => parsed(key, min, max) === null).map((f) => f.key));
  const changes = FIELDS.flatMap(({ key, min, max }) => {
    const to = parsed(key, min, max);
    return to !== null && to !== settings[key] ? [{ key, from: settings[key], to }] : [];
  });
  const dirty = FIELDS.some(({ key }) => draft[key].trim() !== String(settings[key]));

  const save = useMutation({
    mutationFn: () => apiSettings.update(Object.fromEntries(changes.map((c) => [c.key, c.to])) as SettingsPatch),
    onSuccess: (saved) => {
      qc.setQueryData(qk.settings, saved);
      toast.success(t("settings.saved"));
      return invalidateSettings(qc);
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (changes.length > 0 && invalid.size === 0) setConfirming(true);
  };

  const sentence = (c: (typeof changes)[number]) =>
    c.key === "holdHours" ? t("settings.change.holdHours", { hours: fmtHours(c.to) })
      : c.key === "loanDays" ? t("settings.change.loanDays", { days: fmtDays(c.to) })
        : t("settings.change.generic", { label: t(`settings.${c.key}`), from: c.from, to: c.to });

  return (
    <form onSubmit={submit} noValidate>
      <Panel flush>
        <div className="divide-y">
          {FIELDS.map(({ key, min, max }) => {
            const bad = invalid.has(key);
            return (
              <div key={key} className="grid gap-x-8 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-start">
                <div className="min-w-0">
                  <Label htmlFor={`rule-${key}`}>{t(`settings.${key}`)}</Label>
                  <p id={`rule-${key}-hint`} className="mt-1 max-w-prose text-sm text-muted-foreground">
                    {t(`settings.${key}Hint`)}
                  </p>
                  {bad && (
                    <p id={`rule-${key}-error`} className="mt-1 text-sm font-medium text-danger">
                      {t("settings.range", { min, max })}
                    </p>
                  )}
                </div>
                <Input
                  id={`rule-${key}`} type="text" inputMode="numeric" dir="ltr" autoComplete="off"
                  className="tabular sm:text-end"
                  value={draft[key]} aria-invalid={bad || undefined}
                  aria-describedby={`rule-${key}-hint${bad ? ` rule-${key}-error` : ""}`}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">
          {t("settings.renewWindow", { days: fmtDays(settings.renewWindowDays) })}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t bg-surface px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {settings.updatedBy
              ? t("settings.lastChanged", { when: fmtDateTime(settings.updatedAt), who: settings.updatedBy })
              : t("settings.neverChanged")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!dirty || save.isPending} onClick={() => setDraft(fromSettings(settings))}>
              {t("settings.discard")}
            </Button>
            <Button type="submit" disabled={changes.length === 0 || invalid.size > 0 || save.isPending}>
              {save.isPending ? t("settings.saving") : t("settings.save")}
            </Button>
          </div>
        </div>
      </Panel>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="space-y-1.5">
                {changes.map((c) => <li key={c.key}>{sentence(c)}</li>)}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.keepEditing")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate()}>{t("settings.save")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
