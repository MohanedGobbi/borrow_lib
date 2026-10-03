import { useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { apiBooks, apiCategories } from "@/api";
import { invalidateCatalog, qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { BookEditDialog } from "@/components/BookEditDialog";
import { Availability } from "@/components/BookActions";
import { Pager } from "@/components/Pager";
import { PageHeader, Panel } from "@/components/Page";
import { GuardedButton } from "@/components/GuardedButton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const { data: result, isPending } = useQuery({
    queryKey: qk.books.list({ search, page }),
    queryFn: () => fetchPage((p) => apiBooks.list({ search, page: p }), page),
    placeholderData: keepPreviousData,
  });
  const { run, busyId } = useStaffAction(invalidateCatalog);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Book | null>(null);

  if (isPending) return <FullPageLoader />;

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

      <CategoryManager />

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
                      <Link dir="auto" to={`/books/${b.id}`} className="font-medium hover:text-brand-dark hover:underline">{b.title}</Link>
                      <div dir="auto" className="text-xs text-muted-foreground">{b.author}</div>
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
                        <GuardedButton
                          size="icon-sm" variant="ghost"
                          className="text-muted-foreground hover:bg-danger-soft hover:text-danger focus-visible:text-danger"
                          aria-label={`${t("dash.deleteBook")}: ${b.title}`}
                          title={deletable ? t("dash.deleteBook") : undefined}
                          reason={deletable ? undefined : t("dash.cannotDelete")}
                          disabled={busyId === b.id}
                          onClick={() => setDeleting(b)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </GuardedButton>
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

      <BookEditDialog book={editBook} open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Deleting is final: name the book, and make Cancel the default focus (Radix does that for AlertDialog). */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title", { title: deleting?.title ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("delete.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleting && run(deleting.id, () => apiBooks.remove(deleting.id), t("toast.bookDeleted"))}
            >
              {t("dash.deleteBook")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Category manager: add categories, edit colors, delete empty ones. */
function CategoryManager() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: categories } = useQuery({ queryKey: qk.categories.all, queryFn: apiCategories.list });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1F6E43");

  const change = useMutation({
    mutationFn: ({ fn }: { fn: () => Promise<unknown>; ok: string }) => fn(),
    onSuccess: (_data, { ok }) => {
      toast.success(ok);
      return invalidateCatalog(qc);
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });
  const act = (fn: () => Promise<unknown>, ok: string) => change.mutate({ fn, ok });

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
