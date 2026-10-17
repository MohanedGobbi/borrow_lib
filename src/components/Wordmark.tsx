import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * The official seal of the University of Ghardaia. It keeps its own colours (the one deliberate exception to
 * the green, white and red palette): never recolour, outline, shadow, stretch or crop it, and never set it on
 * red or on a green fill. Leave clear space of a quarter of its height on every side.
 *
 * The source is 160px wide, so it is never shown larger than about 72 CSS px (set the height with a class).
 * It is decorative wherever it sits next to the university's name, so it carries an empty `alt`.
 */
export function Seal({ className }: { className?: string }) {
  return (
    <img
      src="/brand/ghardaia-seal.png"
      srcSet="/brand/ghardaia-seal.png 1x, /brand/ghardaia-seal@2x.png 2x, /brand/ghardaia-seal@3x.png 3x"
      width={157}
      height={148}
      alt=""
      draggable={false}
      decoding="async"
      className={cn("w-auto shrink-0 select-none", className)}
    />
  );
}

/**
 * The LibBorrow wordmark with the university's seal: the seal first (start side), a hairline divider, then
 * "LibBorrow" in Source Serif 4 semibold over (or, on wide screens in the header, beside) a small Public Sans
 * line naming the university. The seal never replaces the wordmark. Tracking is set per size, as type is
 * optically: slightly open at 20px, tighter at display sizes.
 *
 * - `header`: seal 32px (40px from `lg`), name 20px stacked, 22px with the line beside it from `lg`;
 * - `footer`: seal 56px (64px from `md`), name 30px stacked;
 * - `display`: seal 64px above a 64px-and-up name, for the sign-in panel;
 * - `card`: seal 44px, name 26px stacked, for the library card.
 */
export function Wordmark({
  size = "header", tone = "ink", className,
}: { size?: "header" | "footer" | "display" | "card"; tone?: "ink" | "white"; className?: string }) {
  const { t } = useI18n();
  const white = tone === "white";
  const display = size === "display";
  return (
    <span
      className={cn(
        "inline-flex select-none",
        display ? "flex-col items-start" : "items-center",
        className,
      )}
    >
      <Seal
        className={cn(
          size === "header" && "h-8 lg:h-10",
          size === "footer" && "h-14 md:h-16",
          size === "card" && "h-11",
          display && "mb-7 h-16",
        )}
      />
      {!display && (
        <span
          aria-hidden
          className={cn(
            "w-px shrink-0",
            white ? "bg-white/35" : "bg-ink/15",
            size === "header" && "mx-2.5 h-7 sm:mx-3 lg:mx-3.5 lg:h-8",
            size === "footer" && "mx-4 h-12",
            size === "card" && "mx-3.5 h-9",
          )}
        />
      )}
      <span className={cn("inline-flex min-w-0", size === "header" ? "flex-col lg:flex-row lg:items-center" : "flex-col")}>
        <span
          lang="en"
          dir="ltr"
          className={cn(
            "font-display font-semibold leading-none",
            white ? "text-white" : "text-ink",
            size === "header" && "text-[1.25rem] tracking-[-0.004em] lg:text-[1.375rem]",
            size === "footer" && "text-[1.875rem] tracking-[-0.014em]",
            size === "card" && "text-[1.625rem] tracking-[-0.012em]",
            display && "text-[clamp(4rem,2.5rem+3vw,5.25rem)] tracking-[-0.026em]",
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
            size === "header" && "mt-[5px] text-[11.5px] sm:text-xs lg:mt-0 lg:text-[13.5px] lg:font-normal",
            size === "footer" && "mt-2.5 text-[13px]",
            size === "card" && "mt-2 text-[12.5px]",
            display && "mt-4 text-base sm:text-[17px]",
          )}
        >
          {size === "footer" ? t("brand.libraryLine") : t("brand.library")}
        </span>
      </span>
    </span>
  );
}
