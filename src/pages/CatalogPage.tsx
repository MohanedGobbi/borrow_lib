import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchX, Search } from "lucide-react";
import { apiBooks, apiCategories } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { BookCover } from "@/components/BookCover";
import { BorrowNotice } from "@/components/BorrowNotice";
import { Availability, BookActions } from "@/components/BookActions";
import { Container } from "@/components/Layout";
import { Pager } from "@/components/Pager";
import { EmptyState, ErrorState, PageHeader, RowsSkeleton } from "@/components/Page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

  const categoryList = [
    { name: "", label: t("catalog.all"), count: (categories ?? []).reduce((n, c) => n + (c.bookCount ?? 0), 0), color: null as string | null },
    ...(categories ?? []).map((c) => ({ name: c.name, label: c.name, count: c.bookCount ?? 0, color: c.color })),
  ];

  const availableToggle = (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
      <Checkbox
        checked={availableOnly}
        onCheckedChange={(v) => setParam("available", v === true ? "1" : "")}
      />
      {t("catalog.availableOnly")}
    </label>
  );

  return (
    <Container>
      <PageHeader
        title={t("catalog.title")}
        description={result ? <span className="tabular">{result.count} {t("catalog.titles")}</span> : null}
      />

      <BorrowNotice className="mt-6" />

      {/* Search first: one wide field, the way the landing page asks for it. */}
      <div className="relative mt-8">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={search}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder={t("catalog.search")}
          aria-label={t("catalog.search")}
          className="h-14 rounded-lg bg-white ps-12 text-base shadow-[0_1px_2px_rgb(16_24_20/0.05)] md:text-[17px]"
        />
      </div>

      {/* Phones and tablets: the filters fold into one quiet row under the search. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 lg:hidden">
        <Select value={category || "all"} onValueChange={(v) => setParam("category", v === "all" ? "" : v)}>
          <SelectTrigger className="h-10 w-full bg-white sm:w-64" aria-label={t("catalog.categories")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("catalog.all")}</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {availableToggle}
      </div>

      <div className="mt-6 grid gap-12 lg:mt-10 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label={t("catalog.categories")}>
            <h2 className="px-2.5 text-[13px] font-semibold text-ink">{t("catalog.categories")}</h2>
            <ul className="mt-3 space-y-px">
              {categoryList.map((c) => (
                <li key={c.name || "all"}>
                  <button
                    type="button"
                    onClick={() => setParam("category", c.name)}
                    aria-current={category === c.name ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-start text-[15px] transition-colors",
                      category === c.name ? "bg-brand-soft font-medium text-brand-dark" : "text-ink/75 hover:bg-surface hover:text-ink",
                    )}
                  >
                    {c.color
                      ? <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: c.color }} aria-hidden />
                      : <span className="size-2 shrink-0" aria-hidden />}
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="tabular text-[13px] text-muted-foreground">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8 border-t px-2.5 pt-6">{availableToggle}</div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="mt-5 rounded-sm px-2.5 text-sm font-medium text-brand-dark underline-offset-4 hover:underline"
            >
              {t("catalog.clear")}
            </button>
          )}
        </aside>

        {/* results */}
        <div className="min-w-0">
          {isPending && <div className="border-y"><RowsSkeleton rows={6} /></div>}
          {isError && <ErrorState message={t("catalog.loadError")} onRetry={() => refetch()} />}

          {result && !isError && result.results.length === 0 && (
            <div className="border-y">
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
            <ul className="border-t">
              {result.results.map((b) => (
                <li key={b.id} className="relative grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-5 border-b py-6 transition-colors active:bg-surface sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-7 sm:active:bg-transparent">
                  <Link to={`/books/${b.id}`} tabIndex={-1} aria-hidden className="self-start">
                    <BookCover book={b} size="sm" />
                  </Link>
                  <div className="min-w-0 self-center">
                    <Link to={`/books/${b.id}`} className="type-heading text-ink decoration-ink/30 after:absolute after:inset-0 hover:underline sm:after:hidden">
                      <bdi>{b.title}</bdi>
                    </Link>
                    <p className="mt-1 text-[15px] text-muted-foreground">
                      <bdi>{b.author}</bdi>{b.year ? ` · ${b.year}` : ""}{b.publisher ? <> · <bdi>{b.publisher}</bdi></> : ""}
                    </p>
                    <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
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
                  <div className="hidden sm:col-start-3 sm:block sm:self-center">
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
              className="mt-2 border-t-0 px-0"
            />
          )}
        </div>
      </div>
    </Container>
  );
}
