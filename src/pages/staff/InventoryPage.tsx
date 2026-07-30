import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiBooks, apiCategories } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { BookEditDialog } from "@/components/BookEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullPageLoader } from "@/auth/guards";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

async function act(fn: () => Promise<unknown>, ok: string, after: () => void) {
  try {
    await fn();
    toast.success(ok);
    after();
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "Action failed.");
  }
}

export default function InventoryPage() {
  const { t } = useI18n();
  const { data: books, loading, refetch } = useApi(() => apiBooks.list(), []);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading) return <FullPageLoader />;

  const openEdit = (b: Book | null) => {
    setEditBook(b);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <CategoryManager onChanged={refetch} />

      <div className="rounded-md border border-border bg-cream p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
            {t("dash.inventory")} · {(books ?? []).length}
          </h2>
          <Button size="sm" className="bg-burnt text-white hover:bg-burnt-dark" onClick={() => openEdit(null)}>
            <Plus className="mr-1 size-3.5" /> {t("dash.addBook")}
          </Button>
        </div>

        <div className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto pe-1">
          {(books ?? []).map((b) => {
            const deletable = b.availableCopies === b.totalCopies;
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-white px-3 py-2">
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {b.author} · {b.isbn} · {b.shelfLocation}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: b.category.color }} />
                  {b.category.name}
                </span>
                <span className={cn("font-mono text-[11px] tabular-nums", b.availableCopies === 0 ? "text-danger" : "text-success")}>
                  {b.availableCopies}/{b.totalCopies} {t("dash.avail")}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7" title={t("catalog.edit")} onClick={() => openEdit(b)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-danger disabled:opacity-30"
                    title={deletable ? "Delete book" : "Cannot delete — copies on loan"}
                    disabled={!deletable}
                    onClick={() => act(() => apiBooks.remove(b.id), "Book deleted.", refetch)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BookEditDialog book={editBook} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={refetch} />
    </div>
  );
}

/** Category manager: add categories, edit colors, delete empty ones. */
function CategoryManager({ onChanged }: { onChanged: () => void }) {
  const { data: categories, refetch } = useApi(() => apiCategories.list(), []);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#CC8800");

  const changed = () => { refetch(); onChanged(); };

  return (
    <div className="rounded-md border border-border bg-white p-4">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">Categories</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(categories ?? []).map((c) => (
          <span key={c.id} className="group flex items-center gap-2 rounded-sm border border-border bg-cream px-2 py-1">
            <input
              type="color"
              value={c.color}
              aria-label={`${c.name} color`}
              className="size-5 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              onChange={(e) => act(() => apiCategories.update(c.id, { color: e.target.value }), "Category color updated.", changed)}
            />
            <span className="text-xs font-semibold">{c.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{c.bookCount ?? 0}</span>
            {(c.bookCount ?? 0) === 0 && (
              <button
                className="text-danger opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete empty category"
                onClick={() => act(() => apiCategories.remove(c.id), "Category deleted.", changed)}
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          className="h-8 w-48" placeholder="New category name"
          value={name} onChange={(e) => setName(e.target.value)}
        />
        <input
          type="color" value={color} aria-label="New category color"
          className="size-8 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
          onChange={(e) => setColor(e.target.value)}
        />
        <Button
          size="sm" className="h-8 bg-ink text-white"
          disabled={!name.trim()}
          onClick={() => {
            act(() => apiCategories.create({ name: name.trim(), color }), "Category created.", changed);
            setName("");
          }}
        >
          <Plus className="mr-1 size-3.5" /> Add
        </Button>
      </div>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        Category colors theme the catalog when members filter by category.
      </p>
    </div>
  );
}
