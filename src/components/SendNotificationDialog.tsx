import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { apiMisc, apiUsers } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ACCOUNT_TYPES, type AccountType, type Profile } from "@/types";

const MAX = 500;

/**
 * Staff dialog: write a message and choose who receives it, by account type (every student, every professor…)
 * and/or person by person. It arrives as an in-app notification; members who switched announcements off are skipped.
 */
export function SendNotificationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [types, setTypes] = useState<AccountType[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const term = useDebounced(search.trim(), 300);

  // Start empty each time the dialog opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setMessage("");
      setTypes([]);
      setPeople([]);
      setSearch("");
      setError(null);
    }
  }

  const params = { search: term, pageSize: 6 };
  const { data: found } = useQuery({
    queryKey: qk.users.list(params), queryFn: () => apiUsers.list(params), enabled: open && term.length > 1,
  });
  const matches = (found?.results ?? []).filter((u) => !people.some((p) => p.id === u.id));

  const send = useMutation({
    mutationFn: () => apiMisc.sendNotification({ message: message.trim(), accountTypes: types, userIds: people.map((p) => p.id) }),
    onSuccess: ({ sent }) => {
      toast.success(t("announce.sent", { n: sent }));
      onOpenChange(false);
    },
    onError: (err) => setError(errorMessage(t, err)),
  });

  const toggle = (type: AccountType, on: boolean) => setTypes((list) => (on ? [...list, type] : list.filter((x) => x !== type)));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!types.length && !people.length) {
      setError(t("err.recipients_missing"));
      return;
    }
    send.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-xl overflow-y-auto bg-white">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t("announce.title")}</DialogTitle>
            <DialogDescription>{t("announce.desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="announce-message">{t("announce.message")}</Label>
            <Textarea
              id="announce-message" required rows={4} maxLength={MAX} dir="auto"
              value={message} onChange={(e) => setMessage(e.target.value)} aria-describedby="announce-count"
            />
            <p id="announce-count" className="tabular text-end text-xs text-muted-foreground">{message.length} / {MAX}</p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t("announce.byType")}</legend>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACCOUNT_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-2.5">
                  <Checkbox id={`announce-${type}`} checked={types.includes(type)} onCheckedChange={(v) => toggle(type, v === true)} />
                  <Label htmlFor={`announce-${type}`} className="text-[15px] font-normal">{t(`accountType.${type}`)}</Label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="announce-search" className="font-semibold">{t("announce.byPerson")}</Label>
            {people.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <li key={p.id} className="inline-flex items-center gap-1 rounded-full border bg-surface py-0.5 pe-1 ps-2.5 text-sm">
                    <bdi>{p.name}</bdi>
                    <button
                      type="button" onClick={() => setPeople((list) => list.filter((x) => x.id !== p.id))}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-white hover:text-ink"
                      aria-label={t("announce.remove", { name: p.name })}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="announce-search" type="search" className="ps-8" placeholder={t("users.search")}
                value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off"
              />
            </div>
            {term.length > 1 && matches.length > 0 && (
              <ul className="divide-y rounded-md border">
                {matches.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => { setPeople((list) => [...list, u]); setSearch(""); }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <bdi className="font-medium">{u.name}</bdi>
                        <span dir="ltr" className="ms-2 text-xs text-muted-foreground">{u.email}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{t(`accountType.${u.accountType}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={send.isPending}>{send.isPending ? t("announce.sending") : t("announce.send")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
