import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Briefcase,
  Check,
  Copy,
  GraduationCap,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DEMO_PASSWORD } from "@/api/client";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DemoPersona {
  name: string;
  email: string;
  roleKey: string;
  descKey: string;
  icon: LucideIcon;
  badgeClass: string;
  isOverdue?: boolean;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    name: "Eleanor Vance",
    email: "admin@libborrow.dev",
    roleKey: "role.ADMIN",
    descKey: "auth.demoDescAdmin",
    icon: ShieldCheck,
    badgeClass: "border-brand/30 bg-brand-soft text-brand-dark",
  },
  {
    name: "Marcus Holloway",
    email: "staff@libborrow.dev",
    roleKey: "role.STAFF",
    descKey: "auth.demoDescStaff",
    icon: Briefcase,
    badgeClass: "border-brand/30 bg-brand-soft text-brand-dark",
  },
  {
    name: "Priya Sharma",
    email: "priya@example.com",
    roleKey: "role.MEMBER",
    descKey: "auth.demoDescStudent",
    icon: GraduationCap,
    badgeClass: "border-border bg-surface text-foreground",
  },
  {
    name: "Daniel Okafor",
    email: "daniel@example.com",
    roleKey: "role.MEMBER",
    descKey: "auth.demoDescOverdue",
    icon: AlertTriangle,
    badgeClass: "border-danger/30 bg-danger-soft text-danger",
    isOverdue: true,
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingInEmail, setSigningInEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const signIn = async (address: string, secret: string) => {
    setBusy(true);
    setError(null);
    try {
      await login(address, secret);
      navigate(location.state?.from ?? "/catalog", { replace: true });
    } catch (err) {
      setError(errorMessage(t, err, "auth.failed"));
    } finally {
      setBusy(false);
      setSigningInEmail(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn(email.trim(), password);
  };

  const fillAccount = (a: DemoPersona) => {
    setEmail(a.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
    toast.success(t("auth.demoFilled", { name: a.name }));
  };

  const signInAs = (address: string) => {
    setSigningInEmail(address);
    setEmail(address);
    setPassword(DEMO_PASSWORD);
    signIn(address, DEMO_PASSWORD);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(DEMO_PASSWORD);
      setCopied(true);
      toast.success(t("auth.demoCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AuthLayout wide>
      <AuthHeading title={t("auth.signin")}>{t("auth.signinSub")}</AuthHeading>

      {/* Quick Demo Access Section */}
      <section aria-labelledby="demo-accounts-heading" className="mt-7 rounded-md border border-brand/20 bg-brand-soft/30 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/15 pb-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-brand shrink-0" aria-hidden />
            <h2 id="demo-accounts-heading" className="text-xs font-semibold uppercase tracking-wider text-brand-dark">
              {t("auth.demoQuick")}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t("auth.demoPasswordLabel")}</span>
            <button
              type="button"
              onClick={copyPassword}
              className="inline-flex items-center gap-1 rounded border border-field-stroke/70 bg-white px-2 py-0.5 font-mono text-xs font-medium text-ink transition-colors hover:border-brand/40"
              title={t("auth.demoCopy")}
            >
              <span dir="ltr">{DEMO_PASSWORD}</span>
              {copied ? <Check className="size-3 text-brand" /> : <Copy className="size-3 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {DEMO_PERSONAS.map((a) => {
            const isSigningInThis = busy && signingInEmail === a.email;
            const firstName = a.name.split(" ")[0];
            return (
              <div
                key={a.email}
                className="flex flex-col justify-between rounded-md border border-hairline/80 bg-white p-3 shadow-xs transition-colors hover:border-brand/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-ink leading-tight">{a.name}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border", a.badgeClass)}>
                      <a.icon className="size-3 shrink-0" aria-hidden />
                      <span>{t(a.roleKey)}{a.isOverdue ? ` · ${t("status.OVERDUE")}` : ""}</span>
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground truncate" dir="ltr">
                    {a.email}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground line-clamp-2">
                    {t(a.descKey)}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-hairline/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => fillAccount(a)}
                    className="h-8 flex-1 text-xs"
                  >
                    {t("auth.demoFill")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => signInAs(a.email)}
                    className="h-8 flex-1 text-xs gap-1.5 bg-brand hover:bg-brand-dark text-white"
                  >
                    {isSigningInThis ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <LogIn className="size-3.5" aria-hidden />
                    )}
                    <span>{t("auth.demoSignInAs", { name: firstName })}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-hairline" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 font-medium text-muted-foreground">
            {t("auth.demoOrManual")}
          </span>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5" noValidate={false}>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-sm font-medium text-brand-dark hover:underline">{t("auth.forgot")}</Link>
          </div>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full">
          {busy && !signingInEmail ? t("auth.signing") : t("auth.signin")}
        </Button>
      </form>

      <p className="mt-6 text-[15px] text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/signup" className="font-medium text-brand-dark hover:underline">{t("auth.createOne")}</Link>
      </p>
    </AuthLayout>
  );
}
