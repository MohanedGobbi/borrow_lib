import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * The LibBorrow wordmark: the name in Source Serif 4 semibold over (or, on wide screens, beside) a small
 * Public Sans line naming the institution. No symbol. Tracking is set per size, as type is optically:
 * slightly open at 20px, tighter at display sizes.
 *
 * - `header`: 20px stacked, 22px with the line beside it from `lg`;
 * - `footer`: 30px stacked;
 * - `display`: 64px and up, for the sign-in panel;
 * - `card`: 26px stacked, for the library card.
 */
export function Wordmark({
  size = "header", tone = "ink", className,
}: { size?: "header" | "footer" | "display" | "card"; tone?: "ink" | "white"; className?: string }) {
  const { t } = useI18n();
  const white = tone === "white";
  return (
    <span
      className={cn(
        "inline-flex select-none",
        size === "header" ? "flex-col lg:flex-row lg:items-center" : "flex-col",
        className,
      )}
    >
      <span
        lang="en"
        dir="ltr"
        className={cn(
          "font-display font-semibold leading-none",
          white ? "text-white" : "text-ink",
          size === "header" && "text-[1.25rem] tracking-[-0.004em] lg:text-[1.375rem]",
          size === "footer" && "text-[1.875rem] tracking-[-0.014em]",
          size === "card" && "text-[1.625rem] tracking-[-0.012em]",
          size === "display" && "text-[clamp(4rem,2.5rem+3vw,5.25rem)] tracking-[-0.026em]",
        )}
      >
        LibBorrow
      </span>
      {size === "header" && (
        <span aria-hidden className={cn("mx-3.5 hidden h-5 w-px lg:block", white ? "bg-white/35" : "bg-ink/15")} />
      )}
      <span
        className={cn(
          "whitespace-nowrap font-sans font-medium leading-none",
          white ? "text-white/80" : "text-muted-foreground",
          size === "header" && "mt-[5px] text-xs lg:mt-0 lg:text-[13.5px] lg:font-normal",
          size === "footer" && "mt-2.5 text-[13px]",
          size === "card" && "mt-2 text-[12.5px]",
          size === "display" && "mt-4 text-base sm:text-[17px]",
        )}
      >
        {t("brand.library")}
      </span>
    </span>
  );
}
