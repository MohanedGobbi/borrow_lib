import { useI18n } from "@/i18n";

/** The one-line list of keyboard shortcuts under a desk queue. Hidden on phones, where there is no keyboard. */
export function KeyHint({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <p className="hidden text-[13px] text-muted-foreground sm:block">
      <span className="font-medium text-ink/80">{t("keys.title")}</span>
      <span aria-hidden> · </span>
      {text}
    </p>
  );
}
