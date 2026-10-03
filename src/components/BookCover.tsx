import { cn } from "@/lib/utils";
import type { Book } from "@/types";

/**
 * Book cover: the uploaded image when present, otherwise a plain library
 * binding in the book's cloth color with the title set on the front board.
 */
export function BookCover({ book, className, size = "md" }: { book: Book; className?: string; size?: "sm" | "md" | "lg" }) {
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
        <div className={cn("relative flex flex-1 flex-col ps-[16%] pe-[9%]", size === "lg" ? "pt-[18%]" : "pt-[16%]")}>
          <span className="block h-px w-6 bg-white/50" />
          <span dir="auto" className={cn(
            "mt-2 font-semibold leading-tight line-clamp-4",
            size === "lg" ? "text-base sm:text-lg" : "text-[11px]",
          )}>
            {book.title}
          </span>
          <span dir="auto" className={cn("mt-auto pb-[14%] leading-tight text-white/85 line-clamp-2", size === "lg" ? "text-[13px] sm:text-sm" : "text-[9px]")}>
            {book.author}
          </span>
        </div>
      )}
    </div>
  );
}
