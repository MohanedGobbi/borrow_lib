import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { KeyRound, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import { useKonami } from "@/hooks/useKonami";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const staffUnlocked = useKonami();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (staffUnlocked) toast.info(t("auth.konami"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUnlocked]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from ?? "/catalog", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t("auth.wrongCreds") : t("auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-md border border-border bg-white md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-burnt p-8 text-white md:flex">
        <LibraryBig className="size-10" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-80">{t("auth.signin")}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">LibBorrow</h1>
          <p className="mt-3 text-sm opacity-90">{t("auth.signinSub")}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-60">
          48h pickup · 14-day loans
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 p-6 md:p-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("auth.signin")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.signinSub")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <p role="alert" className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full bg-brand text-white hover:bg-brand-dark">
          {busy ? t("auth.signing") : t("auth.signin")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link to="/signup" className="font-semibold text-burnt hover:underline">{t("auth.createOne")}</Link>
        </p>
        <div className="rounded-sm bg-cream px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Demo member: priya@example.com · password123
        </div>

        {/* hidden staff access — revealed only via the Konami code */}
        {staffUnlocked && (
          <div className="rounded-sm border-2 border-dashed border-burnt bg-burnt/5 px-3 py-2">
            <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-burnt">
              <KeyRound className="size-3" /> Staff access
            </p>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
              staff@libborrow.dev · gweiss@libborrow.dev · admin@libborrow.dev (password123)
            </p>
            <Link to="/signup?role=staff" className="mt-1 inline-block text-xs font-semibold text-burnt hover:underline">
              Staff registration →
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
