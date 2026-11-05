import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiUsers } from "@/api";
import { invalidateUsers } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCOUNT_TYPES, type AccountType, type Profile } from "@/types";

export function UserEditDialog({
  member, open, onOpenChange, onSuccess,
}: {
  member: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (profile: Profile) => void;
}) {
  const { t } = useI18n();
  const { me } = useAuth();
  const isAdmin = me?.role === "ADMIN";
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    notes: "",
    email: "",
    studentOrStaffId: "",
    accountType: "STUDENT" as AccountType,
    useDefaultLimit: true,
    maxBorrowLimit: "5",
    active: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever dialog opens with a new member
  const [seen, setSeen] = useState<{ open: boolean; memberId: number | null }>({ open: false, memberId: null });
  if (seen.open !== open || seen.memberId !== (member?.id ?? null)) {
    setSeen({ open, memberId: member?.id ?? null });
    if (open && member) {
      setForm({
        name: member.name,
        phoneNumber: member.phoneNumber ?? "",
        notes: member.notes ?? "",
        email: member.email,
        studentOrStaffId: member.studentOrStaffId,
        accountType: member.accountType,
        useDefaultLimit: member.borrowLimitIsDefault,
        maxBorrowLimit: member.maxBorrowLimit ? String(member.maxBorrowLimit) : "5",
        active: member.active,
      });
      setError(null);
    }
  }

  const update = useMutation({
    mutationFn: () => {
      if (!member) throw new Error("No member selected");
      const payload: Parameters<typeof apiUsers.update>[1] = {
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.trim(),
        notes: form.notes.trim(),
      };
      if (isAdmin) {
        payload.email = form.email.trim();
        payload.studentOrStaffId = form.studentOrStaffId.trim();
        payload.accountType = form.accountType;
        payload.maxBorrowLimit = form.useDefaultLimit ? null : Number(form.maxBorrowLimit);
        payload.active = form.active;
      }
      return apiUsers.update(member.id, payload);
    },
    onSuccess: (updated) => {
      toast.success(t("users.updated"));
      onOpenChange(false);
      onSuccess?.(updated);
      return invalidateUsers(qc);
    },
    onError: (err) => setError(errorMessage(t, err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate();
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("users.edit")}</DialogTitle>
          <DialogDescription>{t("users.editSub")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">{t("auth.name")}</Label>
            <Input
              id="edit-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">{t("auth.phone")}</Label>
            <Input
              id="edit-phone"
              type="tel"
              dir="ltr"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="edit-notes">{t("users.notes")}</Label>
              <span className="text-xs text-muted-foreground">{t("users.notesSub")}</span>
            </div>
            <Textarea
              id="edit-notes"
              rows={3}
              placeholder={t("users.notesPlaceholder")}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {isAdmin && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">{t("auth.email")}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  required
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-card-id">{t("col.id")}</Label>
                <Input
                  id="edit-card-id"
                  required
                  dir="ltr"
                  className="font-mono"
                  value={form.studentOrStaffId}
                  onChange={(e) => setForm((f) => ({ ...f, studentOrStaffId: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-account-type">{t("auth.accountType")}</Label>
                <Select
                  value={form.accountType}
                  onValueChange={(v) => setForm((f) => ({ ...f, accountType: v as AccountType }))}
                >
                  <SelectTrigger id="edit-account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`accountType.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.accountType !== "LIBRARIAN" && form.accountType !== "ADMIN" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-borrow-limit">{t("users.limitOverride")}</Label>
                  <div className="flex items-center gap-3">
                    <Select
                      value={form.useDefaultLimit ? "default" : "custom"}
                      onValueChange={(v) => setForm((f) => ({ ...f, useDefaultLimit: v === "default" }))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">{t("users.limitDefault")}</SelectItem>
                        <SelectItem value="custom">{t("users.limitCustom")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {!form.useDefaultLimit && (
                      <Input
                        id="edit-borrow-limit"
                        type="number"
                        min={1}
                        max={100}
                        required
                        className="w-24"
                        value={form.maxBorrowLimit}
                        onChange={(e) => setForm((f) => ({ ...f, maxBorrowLimit: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="edit-active">{t("col.standing")}</Label>
                <Select
                  value={form.active ? "active" : "inactive"}
                  onValueChange={(v) => setForm((f) => ({ ...f, active: v === "active" }))}
                >
                  <SelectTrigger id="edit-active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("users.goodStanding")}</SelectItem>
                    <SelectItem value="inactive">{t("users.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={update.isPending || !form.name.trim()}>
              {update.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
