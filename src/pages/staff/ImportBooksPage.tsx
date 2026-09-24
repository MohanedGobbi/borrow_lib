import { useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Info, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { apiBooks } from "@/api";
import { ApiError } from "@/api/client";
import { useI18n } from "@/i18n";
import { PageHeader, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useStaffContext } from "@/pages/staff/staffContext";
import {
  IMPORT_ACCEPT, IMPORT_MAX_ROWS, ImportFileError, TEMPLATE_HEADERS, TEMPLATE_ROWS,
  downloadText, readImportFile, toCsv, type ImportRowInput,
} from "@/lib/importFile";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import type { ImportReport, ImportRow, ImportStatus } from "@/types";

type Mode = "skip" | "update";
type Phase = "idle" | "reading" | "checking" | "preview" | "importing" | "done";
type Filter = "all" | ImportStatus;

const SHOW_MAX = 500;
const CHANGE_LABEL: Record<string, string> = {
  title: "field.title", author: "field.author", category: "field.category", publisher: "field.publisher",
  year: "field.year", copies: "field.copies", shelf: "field.shelf", description: "field.description",
};
const STATUS_TONE: Record<ImportStatus, string> = {
  create: "border-transparent bg-brand-soft text-brand-dark",
  update: "border-brand/40 bg-white text-brand-dark",
  unchanged: "border-border bg-white text-muted-foreground",
  skip: "border-border bg-white text-muted-foreground",
  error: "border-danger/30 bg-danger-soft text-danger",
};

export default function ImportBooksPage() {
  const { t } = useI18n();
  const { refreshCounts } = useStaffContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<Mode>("skip");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRowInput[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const reset = () => {
    setPhase("idle"); setRows([]); setReport(null); setProblem(null); setFilter("all"); setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const check = async (data: ImportRowInput[], name: string, nextMode: Mode) => {
    setPhase("checking");
    try {
      const r = await apiBooks.importRows({ rows: data, mode: nextMode, dryRun: true, filename: name });
      setReport(r);
      setFilter(r.summary.error > 0 ? "error" : "all");
      setPhase("preview");
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : t("toast.failed"));
      setPhase("idle");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setFileName(file.name);
    setPhase("reading");
    try {
      const data = await readImportFile(file);
      if (data.length > IMPORT_MAX_ROWS) {
        setProblem(t("import.tooMany", { n: data.length }));
        setPhase("idle");
        return;
      }
      setRows(data);
      await check(data, file.name, mode);
    } catch (e) {
      setProblem(e instanceof ImportFileError ? t(`import.fileError.${e.code}`) : t("import.fileError.unreadable"));
      setPhase("idle");
    }
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    if (rows.length) check(rows, fileName, m);
  };

  const confirm = async () => {
    setPhase("importing");
    try {
      const r = await apiBooks.importRows({ rows, mode, dryRun: false, filename: fileName });
      setReport(r);
      setPhase("done");
      refreshCounts();
      toast.success(t("import.doneBody", { c: r.summary.create, u: r.summary.update }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("toast.failed"));
      setPhase("preview");
    }
  };

  const errorText = (err: ImportRow["errors"][number]) => t(`importErr.${err.code}`, err);

  const downloadErrors = () => {
    if (!report) return;
    const failed = new Map(report.rows.filter((r) => r.status === "error").map((r) => [r.row, r]));
    const bad = rows.filter((r) => failed.has(r.__row));
    const headers = [...new Set(bad.flatMap((r) => Object.keys(r)).filter((h) => !h.startsWith("__")))];
    const table = bad.map((r) => [...headers.map((h) => r[h]), failed.get(r.__row)!.errors.map(errorText).join(" ")]);
    const base = fileName.replace(/\.[^.]+$/, "");
    downloadText(`${base}-errors.csv`, toCsv([...headers, "error"], table));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  };

  const busy = phase === "reading" || phase === "checking" || phase === "importing";
  const s = report?.summary;
  const toImport = s ? s.create + s.update : 0;
  const visible = (report?.rows ?? []).filter((r) => filter === "all" || r.status === filter);
  const ignored = Object.entries(report?.columns ?? {}).filter(([, f]) => f === null).map(([h]) => h);

  return (
    <div className="space-y-6">
      <Link to="/staff/inventory" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("staff.inventory")}
      </Link>
      <PageHeader title={t("import.title")} description={t("import.sub")} />

      {phase === "done" && s ? (
        <Panel>
          <div className="flex flex-wrap items-start gap-4">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{t("import.done")}</h2>
              <p className="mt-1 text-[15px] text-muted-foreground">{t("import.doneBody", { c: s.create, u: s.update })}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild><Link to="/staff/inventory">{t("import.toInventory")}</Link></Button>
                <Button variant="outline" onClick={reset}>{t("import.another")}</Button>
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel title={t("import.fileTitle")}>
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
                    <p className="mt-3 font-medium text-ink" dir="auto">{fileName}</p>
                  ) : (
                    <p className="mt-3 text-[15px] text-ink">
                      {t("import.drop")}{" "}
                      <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-brand-dark underline decoration-brand/40 hover:decoration-brand">
                        {t("import.browse")}
                      </button>
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{t("import.limit")}</p>
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

            {problem && (
              <p role="alert" className="mt-4 flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {problem}
              </p>
            )}

            <fieldset className="mt-6" disabled={busy}>
              <legend className="text-sm font-semibold text-ink">{t("import.existing")}</legend>
              <RadioGroup value={mode} onValueChange={(v) => changeMode(v as Mode)} className="mt-3 gap-2.5">
                {(["skip", "update"] as Mode[]).map((m) => (
                  <div key={m} className="flex items-center gap-2.5">
                    <RadioGroupItem value={m} id={`mode-${m}`} />
                    <Label htmlFor={`mode-${m}`} className="text-[15px] font-normal">
                      {m === "skip" ? t("import.modeSkip") : t("import.modeUpdate")}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
          </Panel>

          <Panel title={t("import.columns")} className="h-fit">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("import.columnsHelp")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => downloadText("libborrow-books-template.csv", toCsv(TEMPLATE_HEADERS, TEMPLATE_ROWS))}
              >
                <Download className="size-4" aria-hidden /> {t("import.template")}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => downloadText("libborrow-books-example.json", JSON.stringify(
                  TEMPLATE_ROWS.map((r) => Object.fromEntries(TEMPLATE_HEADERS.map((h, i) => [h, r[i]]))), null, 2,
                ), "application/json")}
              >
                <Download className="size-4" aria-hidden /> {t("import.jsonExample")}
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {report && phase !== "done" && (
        report.missingColumns.length > 0 ? (
          <p role="alert" className="flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-[15px] text-danger">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            {t("import.missing", { list: report.missingColumns.join(", ") })}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 overflow-hidden rounded-md border bg-white sm:grid-cols-5">
              {([
                ["total", t("import.rowsInFile")], ["create", t("import.create")], ["update", t("import.update")],
                ["kept", t("import.unchanged")], ["error", t("import.error")],
              ] as const).map(([k, label]) => {
                const value = k === "kept" ? s!.unchanged + s!.skip : s![k];
                return (
                  <div key={k} className="border-b border-e p-4 [&:nth-child(2n)]:border-e-0 sm:border-b-0 sm:[&:nth-child(2n)]:border-e sm:[&:nth-child(5n)]:border-e-0">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className={cn("tabular mt-1 text-2xl font-semibold leading-none", k === "error" && value > 0 ? "text-danger" : "text-ink")}>
                      {value}
                    </dd>
                  </div>
                );
              })}
            </dl>

            {(ignored.length > 0 || (report.newCategories ?? []).length > 0) && (
              <div className="space-y-1.5 rounded-md border bg-surface px-4 py-3 text-sm text-ink/85">
                {ignored.length > 0 && (
                  <p className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{t("import.ignored", { list: ignored.join(", ") })}</p>
                )}
                {(report.newCategories ?? []).length > 0 && (
                  <p className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{t("import.newCategories", { list: report.newCategories!.join(", ") })}</p>
                )}
              </div>
            )}

            <Panel
              title={t("import.result")}
              count={visible.length}
              flush
              actions={
                <div className="flex flex-wrap gap-1 rounded-md bg-surface p-1" role="tablist" aria-label={t("import.result")}>
                  {(["all", "create", "update", "error", "skip", "unchanged"] as Filter[])
                    .filter((f) => f === "all" || (s![f as ImportStatus] ?? 0) > 0)
                    .map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="tab"
                        aria-selected={filter === f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          "rounded px-2.5 py-1 text-sm font-medium transition-colors",
                          filter === f ? "bg-white text-ink shadow-[0_1px_2px_rgb(16_24_20/0.08)]" : "text-muted-foreground hover:text-ink",
                        )}
                      >
                        {t(`import.${f}`)} <span className="tabular text-xs text-muted-foreground">{f === "all" ? s!.total : s![f]}</span>
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
                      <th className={tableCls.th}>{t("field.isbn")}</th>
                      <th className={tableCls.th}>{t("field.title")}</th>
                      <th className={tableCls.th}>{t("field.copies")}</th>
                      <th className={tableCls.th}>{t("import.result")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, SHOW_MAX).map((r) => (
                      <tr key={r.row} className={cn(tableCls.row, r.status === "error" && "bg-danger-soft/40")}>
                        <td className={cn(tableCls.td, "tabular text-muted-foreground")}>{r.row}</td>
                        <td className={tableCls.td}><span dir="ltr" className="whitespace-nowrap font-mono text-[13px]">{r.isbn || "—"}</span></td>
                        <td className={tableCls.td}>
                          <span className="font-medium" dir="auto">{r.title || "—"}</span>
                          {r.author && <div className="text-xs text-muted-foreground" dir="auto">{r.author}</div>}
                        </td>
                        <td className={cn(tableCls.td, "tabular")}>{r.totalCopies ?? "—"}</td>
                        <td className={tableCls.td}>
                          <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_TONE[r.status])}>
                            {r.status === "error" && <AlertTriangle className="size-3.5" aria-hidden />}
                            {t(`import.${r.status}`)}
                          </span>
                          {r.errors.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-sm text-danger">
                              {r.errors.map((e, i) => <li key={i}>{errorText(e)}</li>)}
                            </ul>
                          )}
                          {r.changes.length > 0 && (
                            <p className="mt-1.5 text-sm text-muted-foreground">
                              {t("import.changes", { list: r.changes.map((c) => t(CHANGE_LABEL[c] ?? c).toLowerCase()).join(", ") })}
                            </p>
                          )}
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

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-white p-4">
              <p className="max-w-xl text-sm text-muted-foreground">
                {toImport === 0 ? t("import.nothing") : s!.error > 0 ? t("import.confirmHelp") : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {s!.error > 0 && (
                  <Button variant="outline" onClick={downloadErrors}>
                    <Download className="size-4" aria-hidden /> {t("import.errorsCsv")}
                  </Button>
                )}
                <Button onClick={confirm} disabled={busy || toImport === 0}>
                  {phase === "importing" ? t("import.importing") : t("import.confirm", { n: toImport })}
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
