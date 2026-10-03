import { useState, type DragEvent, type ReactNode, type RefObject } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Info, Upload } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Page";
import { IMPORT_ACCEPT, downloadText, toCsv } from "@/lib/importFile";
import type { ImportPhase } from "@/hooks/useImportFlow";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";

/** The pieces the bulk import screens (books, students) share. The page decides what the columns and statuses mean. */

const SHOW_MAX = 500;

/** Drop zone with a file picker; shows progress while the file is read, checked or imported. */
export function ImportDropZone({
  phase, fileName, inputRef, limitText, onFile,
}: {
  phase: ImportPhase; fileName: string; inputRef: RefObject<HTMLInputElement | null>;
  limitText: string; onFile: (file: File | undefined) => void;
}) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-brand bg-brand-soft/60" : "border-input bg-surface/60",
      )}
    >
      {phase === "idle" || phase === "preview" ? (
        <>
          <FileSpreadsheet className="size-8 text-muted-foreground" aria-hidden />
          {fileName && phase === "preview" ? (
            <p className="mt-3 font-medium text-ink"><bdi>{fileName}</bdi></p>
          ) : (
            <p className="mt-3 text-[15px] text-ink">
              {t("import.drop")}{" "}
              <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-brand-dark underline decoration-brand/40 hover:decoration-brand">
                {t("import.browse")}
              </button>
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{limitText}</p>
          {phase === "preview" && (
            <Button variant="outline" size="sm" className="mt-4 bg-white" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" aria-hidden /> {t("import.another")}
            </Button>
          )}
        </>
      ) : (
        <p className="flex items-center gap-2 text-[15px] text-muted-foreground" role="status">
          <span className="size-4 animate-spin rounded-full border-2 border-border border-t-brand" aria-hidden />
          {phase === "reading" ? t("import.reading") : phase === "checking" ? t("import.checking") : t("import.importing")}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="sr-only"
        aria-label={t("import.fileTitle")}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}

export function ImportProblem({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-4 flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {message}
    </p>
  );
}

/** The columns panel: what the importer understands, and a CSV template and JSON example to start from. */
export function ImportColumnsPanel({
  help, csvName, jsonName, headers, rows,
}: { help: string; csvName: string; jsonName: string; headers: string[]; rows: (string | number)[][] }) {
  const { t } = useI18n();
  return (
    <Panel title={t("import.columns")} className="h-fit">
      <p className="text-sm leading-relaxed text-muted-foreground">{help}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadText(csvName, toCsv(headers, rows))}>
          <Download className="size-4" aria-hidden /> {t("import.template")}
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => downloadText(jsonName, JSON.stringify(
            rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))), null, 2,
          ), "application/json")}
        >
          <Download className="size-4" aria-hidden /> {t("import.jsonExample")}
        </Button>
      </div>
    </Panel>
  );
}

export function ImportMissingColumns({ list }: { list: string[] }) {
  const { t } = useI18n();
  return (
    <p role="alert" className="flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-[15px] text-danger">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      {t("import.missing", { list: list.join(", ") })}
    </p>
  );
}

/** A row of counters: rows in the file, then one per outcome. `danger` tints a counter red when it is not zero. */
export function ImportStatTiles({ tiles }: { tiles: { key: string; label: string; value: number; danger?: boolean }[] }) {
  const four = tiles.length === 4;
  return (
    <dl className={cn("grid grid-cols-2 overflow-hidden rounded-md border bg-white", four ? "sm:grid-cols-4" : "sm:grid-cols-5")}>
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className={cn(
            "border-b border-e p-4 [&:nth-child(2n)]:border-e-0 sm:border-b-0 sm:[&:nth-child(2n)]:border-e",
            four ? "sm:[&:nth-child(4n)]:border-e-0" : "sm:[&:nth-child(5n)]:border-e-0",
          )}
        >
          <dt className="text-sm text-muted-foreground">{tile.label}</dt>
          <dd className={cn("tabular mt-1 text-2xl font-semibold leading-none", tile.danger && tile.value > 0 ? "text-danger" : "text-ink")}>
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Quiet notes under the counters (ignored columns, categories that will be created). */
export function ImportNotes({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-md border bg-surface px-4 py-3 text-sm text-ink/85">
      {lines.map((line) => (
        <p key={line} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{line}</p>
      ))}
    </div>
  );
}

export interface ImportResultRow {
  row: number;
  status: string;
  errors: ({ code: string } & Record<string, string | number>)[];
}

/** The per-row table with status filter tabs. `columns` are the page's own cells; the last column is the status. */
export function ImportResultPanel<Row extends ImportResultRow>({
  rows, filter, onFilter, counts, statusTone, columns, extra, errorText, statusLabel,
}: {
  /** Every row; the panel filters and truncates. */
  rows: Row[];
  filter: string;
  onFilter: (filter: string) => void;
  /** Tab key and how many rows, in tab order (`all` first); tabs with no rows are left out. */
  counts: [string, number][];
  statusTone: Record<string, string>;
  columns: { header: string; cell: (row: Row) => ReactNode; className?: string }[];
  /** Extra text under a row's status (what an update changes). */
  extra?: (row: Row) => ReactNode;
  errorText: (err: Row["errors"][number]) => string;
  statusLabel: (status: string) => string;
}) {
  const { t } = useI18n();
  const visible = rows.filter((r) => filter === "all" || r.status === filter);
  return (
    <Panel
      title={t("import.result")}
      count={visible.length}
      flush
      actions={
        <div className="flex flex-wrap gap-1 rounded-md bg-surface p-1" role="tablist" aria-label={t("import.result")}>
          {counts.filter(([key, n]) => key === "all" || n > 0).map(([key, n]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => onFilter(key)}
              className={cn(
                "rounded px-2.5 py-1 text-sm font-medium transition-colors",
                filter === key ? "bg-white text-ink shadow-[0_1px_2px_rgb(16_24_20/0.08)]" : "text-muted-foreground hover:text-ink",
              )}
            >
              {statusLabel(key)} <span className="tabular text-xs text-muted-foreground">{n}</span>
            </button>
          ))}
        </div>
      }
    >
      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead>
            <tr>
              <th className={tableCls.th}>{t("import.row")}</th>
              {columns.map((c) => <th key={c.header} className={tableCls.th}>{c.header}</th>)}
              <th className={tableCls.th}>{t("import.result")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, SHOW_MAX).map((r) => (
              <tr key={r.row} className={cn(tableCls.row, r.status === "error" && "bg-danger-soft/40")}>
                <td className={cn(tableCls.td, "tabular text-muted-foreground")}>{r.row}</td>
                {columns.map((c) => <td key={c.header} className={cn(tableCls.td, c.className)}>{c.cell(r)}</td>)}
                <td className={tableCls.td}>
                  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", statusTone[r.status])}>
                    {r.status === "error" && <AlertTriangle className="size-3.5" aria-hidden />}
                    {statusLabel(r.status)}
                  </span>
                  {r.errors.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-sm text-danger">
                      {r.errors.map((e, i) => <li key={i}>{errorText(e)}</li>)}
                    </ul>
                  )}
                  {extra?.(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length > SHOW_MAX && (
        <p className="border-t px-4 py-2.5 text-sm text-muted-foreground">{t("import.showing", { n: SHOW_MAX })}</p>
      )}
    </Panel>
  );
}

/** The bar under the table: the confirm button, and the errors CSV when some rows failed. */
export function ImportConfirmBar({
  help, hasErrors, onErrorsCsv, onConfirm, disabled, importing, confirmLabel,
}: {
  help: string | null; hasErrors: boolean; onErrorsCsv: () => void; onConfirm: () => void;
  disabled: boolean; importing: boolean; confirmLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-white p-4">
      <p className="max-w-xl text-sm text-muted-foreground">{help}</p>
      <div className="flex flex-wrap gap-2">
        {hasErrors && (
          <Button variant="outline" onClick={onErrorsCsv}>
            <Download className="size-4" aria-hidden /> {t("import.errorsCsv")}
          </Button>
        )}
        <Button onClick={onConfirm} disabled={disabled}>
          {importing ? t("import.importing") : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

/** What the page shows once the import ran. */
export function ImportDonePanel({ body, note, actions }: { body: string; note?: string; actions: ReactNode }) {
  const { t } = useI18n();
  return (
    <Panel>
      <div className="flex flex-wrap items-start gap-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{t("import.done")}</h2>
          <p className="mt-1 text-[15px] text-muted-foreground">{body}</p>
          {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
          <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
        </div>
      </div>
    </Panel>
  );
}
