import { cn } from "@/lib/utils";
import type { Book } from "@/types";

/** Book cover: uploaded image when present, otherwise the editorial letter-cover. */
export function BookCover({ book, className }: { book: Book; className?: string }) {
  if (book.coverImage) {
    return (
      <img
        src={book.coverImage}
        alt={book.title}
        className={cn("aspect-[3/4] w-full rounded-sm object-cover", className)}
        loading="lazy"
      />
    );
  }
  const initials = book.title
    .split(" ")
    .filter((w) => /^[A-Za-z\u0600-\u06FF]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-sm p-3 text-white",
        className
      )}
      style={{ backgroundColor: book.coverColor }}
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-white/25" />
      <div className="font-mono text-[10px] uppercase tracking-widest opacity-80">
        {book.category.name}
      </div>
      <div className="text-5xl font-bold tracking-tight opacity-95">{initials}</div>
      <div>
        <div className="text-[11px] font-semibold leading-tight line-clamp-2">{book.title}</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider opacity-75 line-clamp-1">
          {book.author}
        </div>
      </div>
    </div>
  );
}
