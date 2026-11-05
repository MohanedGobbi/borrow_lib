import { useI18n } from "@/i18n";

/** Who built the platform and with whom: the last line of every page's footer. */
export function PartnerCredits() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-4 text-[13px] text-muted-foreground">
      <span>{t("footer.developedBy")}</span>
      <img src="/brand/rowd.png" alt={t("footer.rowdAlt")} width={84} height={19} className="h-[19px] w-auto" />
      <span aria-hidden>·</span>
      <span>{t("footer.partnership")}</span>
      <img src="/brand/afak.png" alt={t("footer.afakAlt")} width={150} height={34} className="h-[34px] w-auto" />
    </div>
  );
}
