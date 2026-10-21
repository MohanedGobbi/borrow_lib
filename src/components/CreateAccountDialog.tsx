import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiUsers } from "@/api";
import { invalidateUsers } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCOUNT_TYPES, type AccountType } from "@/types";

const EMPTY = { name: "", email: "", phoneNumber: "", password: "" };

/**
 * Admin dialog: create an account of any type, other administrators included. With a password the account
 * works straight away (the admin hands the password over); without one, the person gets an email to choose it.
 */
export function CreateAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [accountType, setAccountType] = useState<AccountType>("STUDENT");
  const [error, setError] = useState<string | null>(null);

  // Start empty each time the dialog opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY);
      setAccountType("STUDENT");
      setError(null);
    }
  }

  const create = useMutation({
    mutationFn: () => apiUsers.create({
      name: form.name.trim(), email: form.email.trim(), phoneNumber: form.phoneNumber.trim(),
      password: form.password, accountType, language: lang,
    }),
    onSuccess: (profile) => {
      toast.success(t(form.password ? "users.created" : "users.createdEmailed", { name: profile.name }));
      onOpenChange(false);
      return invalidateUsers(qc);
    },
    onError: (err) => setError(errorMessage(t, err)),
  });

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("users.createTitle")}</DialogTitle>
            <DialogDescription>{t("users.createDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">{t("auth.fullname")}</Label>
            <Input id="new-name" required autoComplete="off" value={form.name} onChange={set("name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-email">{t("auth.email")}</Label>
              <Input id="new-email" type="email" required autoComplete="off" dir="ltr" value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-phone">{t("auth.phone")}</Label>
              <Input id="new-phone" type="tel" required autoComplete="off" dir="ltr" value={form.phoneNumber} onChange={set("phoneNumber")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-type">{t("auth.accountType")}</Label>
            <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
              <SelectTrigger id="new-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(`accountType.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">
              {t("auth.password")} <span className="font-normal text-muted-foreground">{t("auth.optional")}</span>
            </Label>
            <Input id="new-password" type="password" minLength={8} autoComplete="new-password" aria-describedby="new-password-help" value={form.password} onChange={set("password")} />
            <p id="new-password-help" className="text-xs text-muted-foreground">{t("users.passwordHelp")}</p>
          </div>
          {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? t("auth.creating") : t("users.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
