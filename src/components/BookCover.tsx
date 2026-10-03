import { cn } from "@/lib/utils";
import type { Book } from "@/types";

/**
 * Book cover: the uploaded image when present, otherwise a plain library
 * binding in the book's cloth color with the title set on the front board.
 * `sm` is a plain cloth block, `md` shows the title only, `lg` adds the author. `hero` is the book page's
 * cover: a ~96px thumbnail on phones (title only, the real title sits beside it) and the full cover from md.
 */
export function BookCover({ book, className, size = "md" }: { book: Book; className?: string; size?: "sm" | "md" | "lg" | "hero" }) {
  if (book.coverImage) {
    return (
      <img
        src={book.coverImage}
        alt=""
        className={cn("aspect-[2/3] w-full rounded-[3px] object-cover shadow-[0_1px_2px_rgb(0_0_0/0.12)]", className)}
        loading="lazy"
      />
    );
  }
  const full = size === "lg" || size === "hero";
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-[3px] text-white shadow-[0_1px_2px_rgb(0_0_0/0.12)]",
        className,
      )}
      style={{ backgroundColor: book.coverColor }}
    >
      {/* spine hinge */}
      <span className="absolute inset-y-0 start-0 w-[7%] bg-black/15" />
      <span className="absolute inset-y-0 start-[7%] w-px bg-white/15" />
      {size !== "sm" && (
        <div className={cn("relative flex flex-1 flex-col ps-[16%] pe-[9%]", full ? "pt-[18%]" : "pt-[16%]")}>
          <span className="block h-px w-6 bg-white/50" />
          <span dir="auto" aria-hidden className={cn(
            "mt-2 font-semibold leading-tight line-clamp-4",
            size === "lg" ? "text-base sm:text-lg" : size === "hero" ? "text-xs md:text-base lg:text-lg" : "text-xs",
          )}>
            {book.title}
          </span>
          {full && (
            <span dir="auto" aria-hidden className={cn(
              "mt-auto pb-[14%] leading-tight text-white/85 line-clamp-2",
              size === "lg" ? "text-[13px] sm:text-sm" : "hidden text-sm md:block",
            )}>
              {book.author}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
