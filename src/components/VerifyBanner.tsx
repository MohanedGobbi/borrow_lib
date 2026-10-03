import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { apiAuth } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Sends the verification email again and says how it went. */
export function ResendVerificationButton() {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const resend = async () => {
    setState("sending");
    try {
      await apiAuth.resendVerification();
      setState("sent");
    } catch {
      setState("failed");
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button type="button" variant="outline" size="sm" disabled={state === "sending"} onClick={resend}>
        {state === "sending" ? t("verify.resending") : t("verify.resend")}
      </Button>
      <span role="status" className="text-[13px] text-muted-foreground">
        {state === "sent" && (
          <span className="inline-flex items-center gap-1.5 text-brand-dark">
            <Check className="size-4" aria-hidden /> {t("verify.resent")}
          </span>
        )}
        {state === "failed" && t("verify.resendFailed")}
      </span>
    </span>
  );
}

/** Slim notice under the header for a signed-in account whose email address is not confirmed yet. */
export function VerifyBanner({ wide }: { wide?: boolean }) {
  const { me } = useAuth();
  const { t } = useI18n();
  if (!me || me.emailVerified !== false) return null;
  return (
    <div className="border-b bg-surface">
      <div className={cn("mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-[13px] sm:px-6", wide ? "max-w-[1440px]" : "max-w-7xl lg:px-8")}>
        <Mail className="size-4 shrink-0 text-brand" aria-hidden />
        <p className="min-w-0 text-ink/80">
          {t("verify.banner")} {t("verify.sentTo")}{" "}
          <bdi dir="ltr" className="font-medium text-ink">{me.email}</bdi>.
        </p>
        <ResendVerificationButton />
      </div>
    </div>
  );
}
