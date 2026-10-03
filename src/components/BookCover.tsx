import { cn } from "@/lib/utils";
import type { Book } from "@/types";

/**
 * Book cover: the uploaded image when present, otherwise a library binding in the book's cloth colour:
 * a darker spine hinge, a blind-tooled rule framing the front board, the title in the serif display face
 * and the author at the foot.
 * `sm` is a plain cloth block, `md` shows the title only, `lg` adds the author. `hero` is the book page's
 * cover: a ~96px thumbnail on phones (title only, the real title sits beside it) and the full cover from md.
 */
export function BookCover({ book, className, size = "md" }: { book: Book; className?: string; size?: "sm" | "md" | "lg" | "hero" }) {
  if (book.coverImage) {
    return (
      <img
        src={book.coverImage}
        alt=""
        className={cn("aspect-[2/3] w-full rounded-[3px] object-cover shadow-[0_1px_2px_rgb(0_0_0/0.12),0_4px_12px_-6px_rgb(16_24_20/0.25)]", className)}
        loading="lazy"
      />
    );
  }
  const full = size === "lg" || size === "hero";
  return (
    <div
      aria-hidden
      // the spine sits on the side the title script starts from
      dir="auto"
      className={cn(
        "relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-[3px] text-white",
        "shadow-[0_1px_2px_rgb(0_0_0/0.12),0_4px_12px_-6px_rgb(16_24_20/0.25)]",
        className,
      )}
      style={{ backgroundColor: book.coverColor }}
    >
      {/* spine hinge */}
      <span className="absolute inset-y-0 start-0 w-[7%] bg-black/20" />
      <span className="absolute inset-y-0 start-[7%] w-px bg-white/15" />
      {size !== "sm" && (
        <>
          {/* blind-tooled frame on the front board */}
          <span className="absolute inset-y-[4.5%] start-[13%] end-[6%] rounded-[1px] border border-white/[0.14]" />
          <div className={cn("relative flex flex-1 flex-col ps-[19%] pe-[12%]", full ? "pt-[17%]" : "pt-[15%]")}>
            <span
              dir="auto"
              className={cn(
                "font-display font-semibold leading-[1.15] line-clamp-4",
                size === "lg" ? "text-[15px] sm:text-[17px]" : size === "hero" ? "text-xs md:text-lg lg:text-xl" : "text-xs",
              )}
            >
              {book.title}
            </span>
            <span className="mt-[9%] block h-px w-5 bg-white/45" />
            {full && (
              <span
                dir="auto"
                className={cn(
                  "mt-auto pb-[15%] text-[12px] font-medium leading-tight text-white/80 line-clamp-2",
                  size === "lg" ? "sm:text-[13px]" : "hidden md:block md:text-sm",
                )}
              >
                {book.author}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
