import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, Loader2, ScanLine, User } from "lucide-react";
import { apiBooks, apiUsers } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { scannedMemberId } from "@/lib/scan";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { Book, Profile } from "@/types";

type Option =
  | { kind: "member"; id: string; member: Profile }
  | { kind: "book"; id: string; book: Book };

const NARROW = "(max-width: 639px)";

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** The search at the top of every staff page: scan a library card, or look up a member or a book. Press / to focus it. */
export function DeskSearch({ className }: { className?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);

  // The long placeholder would be cut off on a phone.
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // "/" jumps to the search from anywhere in the desk, unless the user is typing somewhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (isEditable(e.target) || document.querySelector("[role='dialog'], [role='alertdialog']")) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const text = value.trim();
  const term = useDebounced(text, 250);
  const searching = term.length >= 2 && scannedMemberId(term) === null;
  const memberParams = { search: term, role: "MEMBER", pageSize: 5 };
  const bookParams = { search: term, pageSize: 5 };
  const members = useQuery({
    queryKey: qk.users.list(memberParams), queryFn: () => apiUsers.list(memberParams),
    enabled: searching, placeholderData: keepPreviousData,
  });
  const books = useQuery({
    queryKey: qk.books.list(bookParams), queryFn: () => apiBooks.list(bookParams),
    enabled: searching, placeholderData: keepPreviousData,
  });

  const shown = searching && text.length >= 2;
  const memberOptions: Option[] = shown
    ? (members.data?.results ?? []).slice(0, 5).map((member) => ({ kind: "member", id: `${listId}-m${member.id}`, member }))
    : [];
  const bookOptions: Option[] = shown
    ? (books.data?.results ?? []).slice(0, 5).map((book) => ({ kind: "book", id: `${listId}-b${book.id}`, book }))
    : [];
  const options = [...memberOptions, ...bookOptions];
  const settled = !members.isFetching && !books.isFetching && term === text;
  const active = options[Math.min(activeIndex, options.length - 1)];

  const reset = () => {
    setValue("");
    setOpen(false);
    setActiveIndex(0);
  };

  const choose = (option: Option) => {
    reset();
    navigate(option.kind === "member" ? `/scan/${option.member.uuid}` : `/books/${option.book.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const member = scannedMemberId(value);
      if (member) {
        reset();
        navigate(`/scan/${member}`);
      } else if (active) {
        choose(active);
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (Math.min(i, options.length - 1) + step + options.length) % options.length);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (value) {
        reset();
      }
    }
  };

  const listOpen = open && shown;

  const row = (option: Option) => {
    const selected = option === active;
    return (
      <li
        key={option.id} id={option.id} role="option" aria-selected={selected}
        // keep the focus in the input: the click must not blur it first
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(option)}
        onMouseMove={() => setActiveIndex(options.indexOf(option))}
        className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", selected && "bg-brand-soft")}
      >
        {option.kind === "member" ? (
          <>
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span dir="auto" className="min-w-0 flex-1 truncate font-medium">{option.member.name}</span>
            <span dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{option.member.studentOrStaffId}</span>
          </>
        ) : (
          <>
            <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate font-medium">{option.book.title}</span>
              <span dir="auto" className="block truncate text-xs text-muted-foreground">{option.book.author}</span>
            </span>
            <span dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{option.book.shelfLocation || option.book.isbn}</span>
          </>
        )}
      </li>
    );
  };

  const group = (key: "m" | "b", items: Option[]) =>
    items.length > 0 && (
      <li role="presentation">
        <ul role="group" aria-labelledby={`${listId}-${key}`}>
          <li role="presentation" id={`${listId}-${key}`} className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
            {t(key === "m" ? "desk.groupMembers" : "desk.groupBooks")}
          </li>
          {items.map(row)}
        </ul>
      </li>
    );

  return (
    <div className={cn("relative max-w-2xl", className)}>
      <ScanLine className="pointer-events-none absolute start-3.5 top-1/2 z-10 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef} type="text" role="combobox" dir="auto" autoComplete="off" spellCheck={false}
        aria-label={t("desk.searchPlaceholder")} aria-keyshortcuts="/"
        aria-expanded={listOpen} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={listOpen && active ? active.id : undefined}
        placeholder={t(narrow ? "desk.searchShort" : "desk.searchPlaceholder")} value={value}
        className="ps-10 pe-10"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {!value && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute end-3 top-1/2 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded border bg-surface px-1.5 font-sans text-xs text-muted-foreground sm:flex"
        >
          /
        </kbd>
      )}
      {shown && !settled && (
        <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      )}

      <ul
        id={listId} role="listbox" aria-label={t("desk.searchPlaceholder")} hidden={!listOpen}
        className="absolute inset-x-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-md border bg-white py-1 shadow-md"
      >
        {group("m", memberOptions)}
        {group("b", bookOptions)}
        {options.length === 0 && (
          <li role="presentation" className="px-3 py-3 text-sm text-muted-foreground">
            {settled ? t("desk.noMatches", { q: text }) : t("desk.searching")}
          </li>
        )}
      </ul>
      <p className="sr-only" role="status">
        {listOpen && settled ? (options.length ? t("desk.results", { n: options.length }) : t("desk.noMatches", { q: text })) : ""}
      </p>
    </div>
  );
}
