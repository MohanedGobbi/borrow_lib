import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * The official seals of the University of Ghardaia and of its Faculty of Law and Political Sciences. They keep
 * their own colours (the one deliberate exception to the green, white and red palette): never recolour, outline,
 * shadow, stretch or crop them, and never set them on red or on a green fill. Leave clear space of a quarter of
 * their height on every side.
 *
 * The sources are about 150px wide (with 2x and 3x files), so they are never shown larger than about 72 CSS px
 * (set the height with a class). They are decorative wherever they sit next to the names, so they carry an empty `alt`.
 */
export function Seal({ className, which = "university" }: { className?: string; which?: "university" | "faculty" }) {
  const name = which === "faculty" ? "faculty-seal" : "ghardaia-seal";
  return (
    <img
      src={`/brand/${name}.png`}
      srcSet={`/brand/${name}.png 1x, /brand/${name}@2x.png 2x, /brand/${name}@3x.png 3x`}
      width={which === "faculty" ? 148 : 157}
      height={148}
      alt=""
      draggable={false}
      decoding="async"
      className={cn("w-auto shrink-0 select-none", className)}
    />
  );
}

/**
 * The library's wordmark: the university's seal and the faculty's seal (start side), a hairline divider, then
 * the library's name over a small line naming the faculty and the university.
 *
 * - `header`: seals 32px (40px from `lg`; the university's from `sm` only), the short name 15px, 17px from `sm`;
 * - `footer`: seals 56px (64px from `md`), the full name 22px;
 * - `display`: seals 64px above the full name set large, for the sign-in panel;
 * - `card`: seals 44px, the full name 18px, for the library card.
 */
export function Wordmark({
  size = "header", tone = "ink", className,
}: { size?: "header" | "footer" | "display" | "card"; tone?: "ink" | "white"; className?: string }) {
  const { t } = useI18n();
  const white = tone === "white";
  const display = size === "display";
  const seal = cn(
    size === "header" && "h-8 lg:h-10",
    size === "footer" && "h-14 md:h-16",
    size === "card" && "h-11",
    display && "h-16",
  );
  return (
    <span className={cn("inline-flex select-none", display ? "flex-col items-start" : "items-center", className)}>
      <span className={cn("inline-flex shrink-0 items-center", display ? "mb-7 gap-3" : "gap-1.5 sm:gap-2")}>
        {/* On phones the header keeps only the faculty's seal, so the bar fits beside the menu. */}
        <Seal className={cn(seal, size === "header" && "hidden sm:block")} />
        <Seal which="faculty" className={seal} />
      </span>
      {!display && (
        <span
          aria-hidden
          className={cn(
            "w-px shrink-0",
            white ? "bg-white/35" : "bg-ink/15",
            size === "header" && "mx-2.5 h-7 sm:mx-3 lg:h-8",
            size === "footer" && "mx-4 h-12",
            size === "card" && "mx-3.5 h-9",
          )}
        />
      )}
      <span className="inline-flex min-w-0 flex-col">
        <span
          className={cn(
            "font-display font-semibold leading-tight",
            white ? "text-white" : "text-ink",
            size === "header" && "whitespace-nowrap text-[15px] sm:text-[17px]",
            size === "footer" && "text-[1.375rem]",
            size === "card" && "text-[1.125rem]",
            display && "text-[clamp(2.25rem,1.5rem+2vw,3.25rem)] leading-[1.15]",
          )}
        >
          {size === "header" ? t("brand.short") : t("brand.name")}
        </span>
        <span
          className={cn(
            "font-sans font-medium leading-snug",
            white ? "text-white/80" : "text-muted-foreground",
            size === "header" && "mt-0.5 hidden whitespace-nowrap text-xs sm:block",
            size === "footer" && "mt-1.5 text-[13px]",
            size === "card" && "mt-1 text-[12.5px]",
            display && "mt-4 text-base sm:text-[17px]",
          )}
        >
          {size === "header" ? t("brand.university") : t("brand.facultyLine")}
        </span>
      </span>
    </span>
  );
}
