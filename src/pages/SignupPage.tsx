import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import { useI18n } from "@/i18n";
import { AuthCard } from "@/pages/LoginPage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [isStaff, setIsStaff] = useState(params.get("role") === "staff");
  const [form, setForm] = useState({
    name: "", email: "", password: "", studentId: "",
    phoneNumber: "", address: "", staffInviteCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        studentId: form.studentId.trim(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
        staffInviteCode: isStaff ? form.staffInviteCode.trim() : "",
      });
      navigate(isStaff ? "/staff" : "/catalog", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  const optional = <span className="font-normal text-muted-foreground">{t("auth.optional")}</span>;

  return (
    <AuthCard wide>
      <h1 className="text-xl font-semibold tracking-tight">{t("auth.create")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("auth.createSub")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("auth.fullname")}</Label>
          <Input id="name" required autoComplete="name" value={form.name} onChange={set("name")} className="h-11" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required autoComplete="email" dir="ltr" value={form.email} onChange={set("email")} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sid">{isStaff ? t("auth.staffId") : t("auth.studentId")}</Label>
            <Input id="sid" required dir="ltr" value={form.studentId} onChange={set("studentId")} className="h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" aria-describedby="pw-hint" value={form.password} onChange={set("password")} className="h-11" />
          <p id="pw-hint" className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("auth.phone")} {optional}</Label>
            <Input id="phone" type="tel" autoComplete="tel" dir="ltr" value={form.phoneNumber} onChange={set("phoneNumber")} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">{t("auth.address")} {optional}</Label>
            <Input id="address" autoComplete="street-address" value={form.address} onChange={set("address")} className="h-11" />
          </div>
        </div>

        <div className="rounded-md border bg-surface p-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium">
            <Checkbox checked={isStaff} onCheckedChange={(v) => setIsStaff(v === true)} />
            {t("auth.isStaff")}
          </label>
          {isStaff && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="invite">{t("auth.invite")}</Label>
              <Input id="invite" required dir="ltr" aria-describedby="invite-hint" value={form.staffInviteCode} onChange={set("staffInviteCode")} className="h-11 bg-white" />
              <p id="invite-hint" className="text-xs text-muted-foreground">{t("auth.inviteHelp")}</p>
            </div>
          )}
        </div>

        {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t("auth.creating") : t("auth.create")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-medium text-brand-dark hover:underline">{t("auth.signin")}</Link>
      </p>
    </AuthCard>
  );
}
