import { Link } from "react-router";
import { FlaskConical } from "lucide-react";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/i18n";

/** A thin strip on every page of the hosted demo, so nobody mistakes it for the library's real site. */
export function DemoBanner() {
  const demo = useDemo();
  const { t } = useI18n();
  if (!demo) return null;
  return (
    <div className="border-b border-brand/20 bg-brand-soft text-[13px] text-brand-dark">
      <p className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <span>{t("demo.banner")}</span>
        <Link to="/login" className="font-medium underline underline-offset-2 hover:no-underline">{t("demo.bannerLink")}</Link>
      </p>
    </div>
  );
}
