import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import { SitePhoto } from "@/components/SitePhoto";
import { Wordmark } from "@/components/Wordmark";
import { cn } from "@/lib/utils";

/**
 * Sign in, sign up, forgot and reset password, email confirmation: the form on white, and from `lg` a
 * black-and-white library photograph beside it carrying the wordmark at display size.
 * Phones get the form alone (the photograph is never downloaded there).
 */
export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const ruleVars = useRuleVars();
  return (
    <div className="grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <SitePhoto slot="auth" sizes="42vw" className="absolute inset-0 size-full object-cover grayscale" />
        <div aria-hidden className="panel-scrim absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-16">
          <Wordmark size="display" tone="white" />
          <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-white/80">{t("auth.panel", ruleVars)}</p>
        </div>
      </div>
      <div className="flex justify-center px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:items-center lg:px-12 lg:py-20">
        <div className={cn("w-full", wide ? "max-w-xl" : "max-w-[26rem]")}>{children}</div>
      </div>
    </div>
  );
}

/** The heading block every auth form starts with. */
export function AuthHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <h1 className="type-title text-ink">{title}</h1>
      {children && <div className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  );
}
