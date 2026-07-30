import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import { useKonami } from "@/hooks/useKonami";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Tab = "member" | "staff";

export default function SignupPage() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const staffUnlocked = useKonami();
  const wantsStaff = params.get("role") === "staff";
  const [tab, setTab] = useState<Tab>("member");
  const [form, setForm] = useState({
    name: "", email: "", password: "", studentId: "",
    phoneNumber: "", address: "", staffInviteCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // staff tab is hidden until the Konami code unlocks it (or a staff link arrives already unlocked)
  useEffect(() => {
    if (staffUnlocked && wantsStaff) setTab("staff");
    if (staffUnlocked) toast.info(t("auth.konami"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUnlocked, wantsStaff]);

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
        staffInviteCode: tab === "staff" ? form.staffInviteCode.trim() : "",
      });
      navigate("/catalog", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-md border border-border bg-white md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-8 text-white md:flex">
        <LibraryBig className="size-10 text-brand" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand">{t("auth.create")}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">LibBorrow</h1>
          <p className="mt-3 text-sm text-white/80">{t("landing.sub")}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">
          members · 5 books &nbsp;/&nbsp; staff · invite code
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 p-6 md:p-8">
        <h2 className="text-2xl font-bold tracking-tight">{t("auth.create")}</h2>

        {staffUnlocked && (
          <div className="grid grid-cols-2 gap-1 rounded-sm bg-cream p-1" role="tablist">
            {(["member", "staff"] as Tab[]).map((tb) => (
              <button
                key={tb}
                type="button"
                role="tab"
                aria-selected={tab === tb}
                onClick={() => setTab(tb)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                  tab === tb ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
                )}
              >
                {tb === "member" ? t("auth.member") : t("auth.staff")}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">{t("auth.fullname")}</Label>
          <Input id="name" required value={form.name} onChange={set("name")} placeholder="Ada Lovelace" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} placeholder="min. 8" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sid">{tab === "staff" ? t("auth.staffId") : t("auth.studentId")}</Label>
            <Input id="sid" required value={form.studentId} onChange={set("studentId")} placeholder={tab === "staff" ? "STF-0101" : "STU-10888"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("auth.phone")} <span className="text-muted-foreground">{t("auth.optional")}</span></Label>
            <Input id="phone" value={form.phoneNumber} onChange={set("phoneNumber")} placeholder="+1 555 …" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">{t("auth.address")} <span className="text-muted-foreground">{t("auth.optional")}</span></Label>
          <Input id="address" value={form.address} onChange={set("address")} placeholder="12 Elm Street" />
        </div>
        {tab === "staff" && (
          <div className="space-y-1.5">
            <Label htmlFor="invite">{t("auth.invite")}</Label>
            <Input id="invite" required value={form.staffInviteCode} onChange={set("staffInviteCode")} placeholder="LIB-STAFF-2024" />
          </div>
        )}

        {error && <p role="alert" className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full bg-burnt text-white hover:bg-burnt-dark">
          {busy ? t("auth.creating") : t("auth.create")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-burnt hover:underline">{t("auth.signin")}</Link>
        </p>
      </form>
    </div>
  );
}
