import { useState } from "react";
import { Link } from "react-router";
import { Check, ClipboardPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiRecords, apiReservations } from "@/api";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { useCart } from "@/cart/CartContext";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

/**
 * The borrowing controls for one book, by role:
 * visitor → sign in; student → request / add to list, or join the waiting list; staff → edit.
 */
export function BookActions({
  book, onChanged, onEdit, size = "sm", className,
}: {
  book: Book; onChanged?: () => void; onEdit?: () => void; size?: "sm" | "default"; className?: string;
}) {
  const { me } = useAuth();
  const { t } = useI18n();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const out = book.availableCopies <= 0;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("toast.failed"));
    } finally {
      setBusy(false);
    }
  };

  if (!me) {
    return (
      <Button asChild size={size} variant="outline" className={className}>
        <Link to="/login" state={{ from: `/books/${book.id}` }}>{t("catalog.signinBorrow")}</Link>
      </Button>
    );
  }

  if (me.role !== "MEMBER") {
    if (!onEdit) {
      return (
        <Button asChild size={size} variant="outline" className={className}>
          <Link to={`/books/${book.id}`}><Pencil className="size-4" aria-hidden /> {t("catalog.edit")}</Link>
        </Button>
      );
    }
    return (
      <Button size={size} variant="outline" className={className} onClick={onEdit}>
        <Pencil className="size-4" aria-hidden /> {t("book.editBook")}
      </Button>
    );
  }

  if (out) {
    return (
      <Button
        size={size} variant="outline" disabled={busy} className={className}
        onClick={() => run(() => apiReservations.create(book.id), t("toast.reserved"))}
      >
        {t("catalog.reserve")}
      </Button>
    );
  }

  const inList = cart.has(book.id);
  return (
    <div className={cn("flex gap-2", size === "default" && "flex-col", className)}>
      <Button
        size={size} disabled={busy} className="flex-1"
        onClick={() => run(() => apiRecords.create(book.id), t("toast.requested"))}
      >
        {size === "default" ? t("book.request") : t("catalog.request")}
      </Button>
      <Button
        size={size} variant="outline" disabled={inList}
        aria-label={inList ? t("catalog.inList") : t("catalog.addList")}
        title={inList ? t("catalog.inList") : t("catalog.addList")}
        onClick={() => { cart.add(book.id); toast.success(t("toast.added")); }}
        className={size === "default" ? "" : "px-2.5"}
      >
        {inList ? <Check className="size-4" aria-hidden /> : <ClipboardPlus className="size-4" aria-hidden />}
        {size === "default" && <span>{inList ? t("catalog.inList") : t("catalog.addList")}</span>}
      </Button>
    </div>
  );
}

/** Availability line: green dot with counts, or a neutral "all on loan" note (red is reserved for overdue). */
export function Availability({ book, className }: { book: Book; className?: string }) {
  const { t } = useI18n();
  const out = book.availableCopies <= 0;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", out ? "text-muted-foreground" : "text-brand-dark", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", out ? "bg-muted-foreground/50" : "bg-brand")} aria-hidden />
      {out
        ? t("catalog.allOnLoan")
        : <span><span className="tabular">{book.availableCopies} / {book.totalCopies}</span> {t("catalog.copiesAvailable")}</span>}
    </span>
  );
}
