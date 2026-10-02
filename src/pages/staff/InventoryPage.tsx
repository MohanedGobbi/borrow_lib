import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { apiBooks, apiCategories } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { BookEditDialog } from "@/components/BookEditDialog";
import { Availability } from "@/components/BookActions";
import { Pager } from "@/components/Pager";
import { PageHeader, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullPageLoader } from "@/auth/guards";
import { useStaffAction } from "@/pages/staff/staffContext";
import { fetchPage } from "@/lib/paging";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

export default function InventoryPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const search = useDebounced(filter.trim(), 300);
  // The page belongs to one search: a new search starts again from page 1.
  const [pageState, setPageState] = useState({ key: search, page: 1 });
  const page = pageState.key === search ? pageState.page : 1;
  const { data: result, loading, refetch } = useApi(
    () => fetchPage((p) => apiBooks.list({ search, page: p }), page), [search, page],
  );
  const { run, busyId } = useStaffAction(refetch);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading && !result) return <FullPageLoader />;

  const openEdit = (b: Book | null) => {
    setEditBook(b);
    setDialogOpen(true);
  };

  const rows = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("staff.inventory")}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/inventory/import"><Upload className="size-4" aria-hidden /> {t("import.title")}</Link>
            </Button>
            <Button size="sm" onClick={() => openEdit(null)}><Plus className="size-4" aria-hidden /> {t("dash.addBook")}</Button>
          </>
        }
      />

      <CategoryManager onChanged={refetch} />

      <Panel
        title={t("dash.books")}
        count={result?.count ?? 0}
        flush
        actions={
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder={t("dash.searchInventory")} aria-label={t("dash.searchInventory")}
              className="h-9 ps-8"
            />
          </div>
        }
      >
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead>
              <tr>
                <th className={tableCls.th}>{t("field.title")}</th>
                <th className={tableCls.th}>{t("col.shelf")}</th>
                <th className={tableCls.th}>{t("field.isbn")}</th>
                <th className={tableCls.th}>{t("col.category")}</th>
                <th className={tableCls.th}>{t("col.availability")}</th>
                <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const deletable = b.availableCopies === b.totalCopies;
                return (
                  <tr key={b.id} className={tableCls.row}>
                    <td className={tableCls.td}>
                      <Link to={`/books/${b.id}`} className="font-medium hover:text-brand-dark hover:underline">{b.title}</Link>
                      <div className="text-xs text-muted-foreground">{b.author}</div>
                    </td>
                    <td className={tableCls.td}><span dir="ltr" className="font-mono text-[13px]">{b.shelfLocation || "—"}</span></td>
                    <td className={tableCls.td}><span dir="ltr" className="whitespace-nowrap font-mono text-[13px] text-muted-foreground">{b.isbn}</span></td>
                    <td className={tableCls.td}>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: b.category.color }} aria-hidden />
                        {b.category.name}
                      </span>
                    </td>
                    <td className={tableCls.td}><Availability book={b} className="whitespace-nowrap" /></td>
                    <td className={tableCls.td}>
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`${t("catalog.edit")}: ${b.title}`} title={t("catalog.edit")} onClick={() => openEdit(b)}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          size="icon-sm" variant="ghost"
                          className="text-danger hover:bg-danger-soft hover:text-danger"
                          aria-label={`${t("dash.deleteBook")}: ${b.title}`}
                          title={deletable ? t("dash.deleteBook") : t("dash.cannotDelete")}
                          disabled={!deletable || busyId === b.id}
                          onClick={() => run(b.id, () => apiBooks.remove(b.id), t("toast.bookDeleted"))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {result && (
          <Pager
            page={result.page} pageSize={result.pageSize} count={result.count}
            onPage={(next) => setPageState({ key: search, page: next })}
          />
        )}
      </Panel>

      <BookEditDialog book={editBook} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={refetch} />
    </div>
  );
}

/** Category manager: add categories, edit colors, delete empty ones. */
function CategoryManager({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n();
  const { data: categories, refetch } = useApi(() => apiCategories.list(), []);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1F6E43");

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      refetch();
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("toast.failed"));
    }
  };

  return (
    <Panel title={t("dash.categories")} count={(categories ?? []).length}>
      <ul className="flex flex-wrap gap-2">
        {(categories ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-md border bg-white py-1 ps-1.5 pe-2">
            <input
              type="color"
              value={c.color}
              aria-label={`${c.name}: ${t("dash.categoryHelp")}`}
              className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
              onChange={(e) => act(() => apiCategories.update(c.id, { color: e.target.value }), t("toast.categoryUpdated"))}
            />
            <span className="text-sm font-medium">{c.name}</span>
            <span className="tabular text-xs text-muted-foreground">{c.bookCount ?? 0}</span>
            {(c.bookCount ?? 0) === 0 && (
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                aria-label={`${t("dash.deleteCategory")}: ${c.name}`}
                title={t("dash.deleteCategory")}
                onClick={() => act(() => apiCategories.remove(c.id), t("toast.categoryDeleted"))}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          act(() => apiCategories.create({ name: name.trim(), color }), t("toast.categoryCreated"));
          setName("");
        }}
      >
        <input
          type="color" value={color} aria-label={t("dash.categoryHelp")}
          className="size-9 cursor-pointer rounded-md border bg-white p-1"
          onChange={(e) => setColor(e.target.value)}
        />
        <Input className="h-9 w-56" placeholder={t("dash.newCategory")} aria-label={t("dash.newCategory")} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
          <Plus className="size-4" aria-hidden /> {t("dash.add")}
        </Button>
        <p className={cn("basis-full text-xs text-muted-foreground")}>{t("dash.categoryHelp")}</p>
      </form>
    </Panel>
  );
}
