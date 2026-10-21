import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { LinkIcon, ShieldCheck } from "lucide-react";
import { apiInvites } from "@/api";
import { MEMBER_TYPES, type MemberType } from "@/types";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Invite =
  | { status: "none" }
  | { status: "checking" }
  | { status: "invalid" }
  | { status: "valid"; email: string; role: "STAFF" | "ADMIN" };

export default function SignupPage() {
  const { register } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const token = params.get("invite");
  const [invite, setInvite] = useState<Invite>(token ? { status: "checking" } : { status: "none" });
  const [form, setForm] = useState({ name: "", email: "", password: "", phoneNumber: "" });
  const [memberType, setMemberType] = useState<MemberType>("STUDENT");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvite({ status: "none" });
      return;
    }
    let current = true;
    setInvite({ status: "checking" });
    apiInvites.lookup(token)
      .then((i) => current && setInvite({ status: "valid", email: i.email, role: i.role }))
      .catch(() => current && setInvite({ status: "invalid" }));
    return () => { current = false; };
  }, [token]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const invited = invite.status === "valid" ? invite : null;
  const email = invited ? invited.email : form.email;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        name: form.name.trim(),
        email: email.trim(),
        password: form.password,
        phoneNumber: form.phoneNumber.trim(),
        memberType,
        language: lang,
        inviteToken: invited && token ? token : undefined,
      });
      if (!invited) toast.success(t("auth.created"));
      navigate(invited ? "/staff" : "/catalog", { replace: true });
    } catch (err) {
      setError(errorMessage(t, err, "auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  const continueAsStudent = () => setParams({}, { replace: true });

  if (invite.status === "checking") {
    return (
      <AuthLayout wide>
        <div role="status" className="py-6">
          <div className="size-7 animate-spin rounded-full border-2 border-border border-t-brand" aria-hidden />
          <p className="mt-4 text-[15px] text-muted-foreground">{t("invite.checking")}</p>
        </div>
      </AuthLayout>
    );
  }

  if (invite.status === "invalid") {
    return (
      <AuthLayout wide>
        <div role="alert">
          <LinkIcon className="size-8 text-muted-foreground" aria-hidden />
          <h1 className="type-title mt-5 text-ink">{t("invite.invalid")}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{t("invite.invalidSub")}</p>
          <Button className="mt-6" onClick={continueAsStudent}>{t("invite.continueStudent")}</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout wide>
      <AuthHeading title={t("auth.create")}>{invited ? null : t("auth.createSub")}</AuthHeading>
      {invited && (
        <p className="mt-4 flex items-center gap-2 rounded-md border bg-surface px-3 py-2 text-sm font-medium text-brand-dark">
          <ShieldCheck className="size-4 shrink-0" aria-hidden /> {t(`invite.joining.${invited.role}`)}
        </p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("auth.fullname")}</Label>
          <Input id="name" required autoComplete="name" value={form.name} onChange={set("name")} className="h-11" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={set("email")}
              readOnly={!!invited} aria-describedby={invited ? "email-locked" : undefined}
              className={invited ? "h-11 bg-surface" : "h-11"}
            />
            {invited && <p id="email-locked" className="text-xs text-muted-foreground">{t("invite.emailLocked")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("auth.phone")}</Label>
            <Input id="phone" type="tel" required autoComplete="tel" dir="ltr" value={form.phoneNumber} onChange={set("phoneNumber")} className="h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" aria-describedby="pw-hint" value={form.password} onChange={set("password")} className="h-11" />
          <p id="pw-hint" className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
        </div>
        {!invited && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">{t("auth.accountType")}</legend>
            <RadioGroup
              value={memberType}
              onValueChange={(v) => setMemberType(v as MemberType)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {MEMBER_TYPES.map((type) => (
                <Label
                  key={type}
                  htmlFor={`type-${type}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-[15px] font-normal has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-soft/50"
                >
                  <RadioGroupItem id={`type-${type}`} value={type} />
                  {t(`accountType.${type}`)}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
        )}

        {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full">
          {busy ? t("auth.creating") : t("auth.create")}
        </Button>
      </form>

      <p className="mt-6 text-[15px] text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-medium text-brand-dark hover:underline">{t("auth.signin")}</Link>
      </p>
    </AuthLayout>
  );
}
