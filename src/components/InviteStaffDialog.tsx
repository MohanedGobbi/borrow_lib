import { useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiInvites } from "@/api";
import { invalidateInvites } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreatedInvite } from "@/types";

/** Admin dialog: email a single-use sign-up link, then show the link once in case the email bounces. */
export function InviteStaffDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  // Start empty each time the dialog opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setEmail("");
      setRole("STAFF");
      setError(null);
      setCreated(null);
      setCopied(false);
    }
  }

  const invite = useMutation({
    mutationFn: () => apiInvites.create({ email: email.trim(), role }),
    onSuccess: (result) => {
      setCreated(result);
      return invalidateInvites(qc);
    },
    onError: (err) => setError(errorMessage(t, err, "invite.failed")),
  });
  const busy = invite.isPending;

  const send = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    invite.mutate();
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      toast.success(t("invite.copied"));
    } catch {
      (document.getElementById("invite-link") as HTMLInputElement | null)?.select(); // clipboard blocked: copy by hand
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("invite.sentTitle")}</DialogTitle>
              <DialogDescription>{t("invite.sentBody")}</DialogDescription>
            </DialogHeader>
            <p dir="ltr" className="text-start text-sm font-medium">{created.email}</p>
            <div className="flex gap-2">
              <Input
                id="invite-link" readOnly dir="ltr" value={created.link} aria-label={t("invite.copy")}
                onFocus={(e) => e.currentTarget.select()} className="font-mono text-[13px]"
              />
              <Button type="button" variant="outline" onClick={copy} className="shrink-0">
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {t("invite.copy")}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>{t("invite.done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("invite.title")}</DialogTitle>
              <DialogDescription>{t("invite.desc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">{t("auth.email")}</Label>
              <Input id="invite-email" type="email" required autoComplete="off" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("col.role")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "STAFF" | "ADMIN")}>
                <SelectTrigger aria-label={t("col.role")} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">{t("role.STAFF")}</SelectItem>
                  <SelectItem value="ADMIN">{t("role.ADMIN")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={busy}>{busy ? t("invite.sending") : t("invite.send")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
