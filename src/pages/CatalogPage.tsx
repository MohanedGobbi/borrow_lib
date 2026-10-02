import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchX, Search } from "lucide-react";
import { apiBooks, apiCategories } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { BookCover } from "@/components/BookCover";
import { Availability, BookActions } from "@/components/BookActions";
import { Container } from "@/components/Layout";
import { Pager } from "@/components/Pager";
import { EmptyState, ErrorState, PageHeader } from "@/components/Page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FullPageLoader } from "@/auth/guards";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchPage } from "@/lib/paging";
import { cn } from "@/lib/utils";

export default function CatalogPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const availableOnly = params.get("available") === "1";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Number(params.get("pageSize")) || undefined;
  const debouncedSearch = useDebounced(search.trim(), 300);

  const { data: categories } = useQuery({ queryKey: qk.categories.all, queryFn: apiCategories.list });
  // The debounced search is part of the key; the previous page stays on screen while the next one loads.
  const listParams = { search: debouncedSearch, category, available: availableOnly, page, pageSize };
  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: qk.books.list(listParams),
    queryFn: () => fetchPage((p) => apiBooks.list({ ...listParams, page: p }), page),
    placeholderData: keepPreviousData,
  });

  // A filter change is not a page change: go back to page 1.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const hasFilters = !!(search || category || availableOnly);

  return (
    <Container>
      <PageHeader
        title={t("catalog.title")}
        description={result ? <span className="tabular">{result.count} {t("catalog.titles")}</span> : null}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* filters */}
        <aside className="space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder={t("catalog.search")}
              aria-label={t("catalog.search")}
              className="h-10 bg-white ps-9"
            />
          </div>

          <div className="lg:hidden">
            <Select value={category || "all"} onValueChange={(v) => setParam("category", v === "all" ? "" : v)}>
              <SelectTrigger className="h-10 w-full bg-white" aria-label={t("catalog.categories")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("catalog.all")}</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav className="hidden lg:block" aria-label={t("catalog.categories")}>
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("catalog.categories")}</h2>
            <ul className="mt-2 space-y-0.5">
              {[{ name: "", label: t("catalog.all"), count: (categories ?? []).reduce((n, c) => n + (c.bookCount ?? 0), 0), color: null as string | null },
                ...(categories ?? []).map((c) => ({ name: c.name, label: c.name, count: c.bookCount ?? 0, color: c.color }))]
                .map((c) => (
                  <li key={c.name || "all"}>
                    <button
                      type="button"
                      onClick={() => setParam("category", c.name)}
                      aria-current={category === c.name ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-[15px] transition-colors",
                        category === c.name ? "bg-brand-soft font-medium text-brand-dark" : "text-ink/80 hover:bg-surface",
                      )}
                    >
                      {c.color
                        ? <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: c.color }} aria-hidden />
                        : <span className="size-2.5 shrink-0" aria-hidden />}
                      <span className="flex-1 truncate">{c.label}</span>
                      <span className="tabular text-xs text-muted-foreground">{c.count}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </nav>

          <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
            <Checkbox
              checked={availableOnly}
              onCheckedChange={(v) => setParam("available", v === true ? "1" : "")}
            />
            {t("catalog.availableOnly")}
          </label>
        </aside>

        {/* results */}
        <div className="min-w-0">
          {isPending && <FullPageLoader />}
          {isError && <ErrorState message={t("catalog.loadError")} onRetry={() => refetch()} />}

          {result && !isError && result.results.length === 0 && (
            <div className="rounded-md border">
              <EmptyState icon={SearchX} title={t("catalog.noMatch")}>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    {t("catalog.clear")}
                  </Button>
                )}
              </EmptyState>
            </div>
          )}

          {result && result.results.length > 0 && (
            <ul className="divide-y rounded-md border bg-white">
              {result.results.map((b) => (
                <li key={b.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-x-5">
                  <Link to={`/books/${b.id}`} tabIndex={-1} aria-hidden className="row-span-2 sm:row-span-1">
                    <BookCover book={b} size="sm" />
                  </Link>
                  <div className="min-w-0">
                    <Link to={`/books/${b.id}`} className="text-base font-semibold leading-snug text-ink hover:text-brand-dark hover:underline">
                      {b.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {b.author}{b.year ? ` · ${b.year}` : ""}{b.publisher ? ` · ${b.publisher}` : ""}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <Availability book={b} />
                      <span className="text-muted-foreground">
                        {t("field.shelf")} <span dir="ltr" className="font-mono text-[13px] text-ink/80">{b.shelfLocation || "—"}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-[2px]" style={{ backgroundColor: b.category.color }} aria-hidden />
                        {b.category.name}
                      </span>
                    </p>
                  </div>
                  <div className="col-start-2 sm:col-start-3 sm:self-center">
                    <BookActions book={b} className="w-full sm:w-44" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {result && (
            <Pager
              page={result.page} pageSize={result.pageSize} count={result.count}
              onPage={(p) => setParam("page", p > 1 ? String(p) : "")}
              className="mt-4 border-t-0 px-0"
            />
          )}
        </div>
      </div>
    </Container>
  );
}
