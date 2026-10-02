import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, LinkIcon } from "lucide-react";
import { apiAuth } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { AuthCard } from "@/pages/LoginPage";
import { ResendVerificationButton } from "@/components/VerifyBanner";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const { me, loading, refresh } = useAuth();
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"checking" | "ok" | "failed">(uid && token ? "checking" : "failed");
  const started = useRef(false);

  useEffect(() => {
    // A link works once, so the check runs once (React's dev double effect must not spend it twice).
    if (loading || started.current || !uid || !token) return;
    started.current = true;
    apiAuth.verifyEmail({ uid, token })
      .then(async () => {
        if (me) await refresh(); // the banner and the borrow buttons follow the new value
        setState("ok");
      })
      .catch(() => setState("failed"));
  }, [loading, uid, token, me, refresh]);

  return (
    <AuthCard>
      <div role="status" className="text-center">
        {state === "checking" && (
          <>
            <div className="mx-auto size-7 animate-spin rounded-full border-2 border-border border-t-brand" aria-hidden />
            <p className="mt-4 text-[15px] text-muted-foreground">{t("verify.checking")}</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto size-8 text-brand" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold tracking-tight">{t("verify.ok")}</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">{t("verify.okSub")}</p>
            <Button asChild className="mt-6">
              <Link to={me ? "/catalog" : "/login"}>{me ? t("verify.catalog") : t("auth.signin")}</Link>
            </Button>
          </>
        )}
        {state === "failed" && (
          <div role="alert">
            <LinkIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold tracking-tight">{t("verify.fail")}</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">{t("verify.failSub")}</p>
            <div className="mt-6 flex justify-center">
              {me && me.emailVerified === false ? (
                <ResendVerificationButton />
              ) : me ? (
                <Button asChild variant="outline"><Link to="/catalog">{t("verify.catalog")}</Link></Button>
              ) : (
                <Button asChild variant="outline"><Link to="/login">{t("verify.signinFirst")}</Link></Button>
              )}
            </div>
          </div>
        )}
      </div>
    </AuthCard>
  );
}
