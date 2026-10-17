import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

/**
 * Book cover: the uploaded image when present, otherwise a flat typographic plate in the palette:
 * a surface ground inside a hairline frame, the title in the serif display face, the author in the UI face
 * and, on the larger plates, a quiet university-name foot line.
 * `sm` is a title-only thumbnail, `md` the title, `lg` adds the author and the foot line. `hero` is the book
 * page's cover: a ~96px thumbnail on phones (no title: the real heading sits beside it) and the full plate from md.
 * The book's `coverColor` is deliberately not used.
 */
export function BookCover({ book, className, size = "md" }: { book: Book; className?: string; size?: "sm" | "md" | "lg" | "hero" }) {
  const { t } = useI18n();
  if (book.coverImage) {
    return (
      <img
        src={book.coverImage}
        alt=""
        className={cn("aspect-[2/3] w-full rounded-[3px] border border-border object-cover", className)}
        loading="lazy"
      />
    );
  }
  const hero = size === "hero";
  const full = size === "lg" || hero;
  return (
    <div
      aria-hidden
      className={cn(
        "flex aspect-[2/3] w-full flex-col overflow-hidden rounded-[3px] border border-border bg-surface text-ink",
        size === "sm" ? "p-[9%]" : "p-[11%]",
        className,
      )}
    >
      <span
        dir="auto"
        className={cn(
          "font-display font-semibold leading-[1.15]",
          size === "sm" && "line-clamp-4 text-[11px]",
          size === "md" && "line-clamp-4 text-xs",
          size === "lg" && "line-clamp-5 text-[15px] sm:text-[17px]",
          hero && "line-clamp-5 text-lg max-md:hidden lg:text-xl",
        )}
      >
        {book.title}
      </span>
      {full && (
        <span
          dir="auto"
          className={cn(
            "mt-[7%] block font-sans font-medium leading-tight text-muted-foreground line-clamp-2",
            size === "lg" ? "text-[12px] sm:text-[13px]" : "text-sm max-md:hidden",
          )}
        >
          {book.author}
        </span>
      )}
      {full && (
        <span
          className={cn(
            "mt-auto block font-sans font-medium uppercase leading-tight tracking-[0.08em] rtl:tracking-normal text-muted-foreground/80",
            hero ? "text-[8px] md:text-[10px]" : "text-[9px] sm:text-[10px]",
          )}
        >
          {t("brand.library")}
        </span>
      )}
    </div>
  );
}
