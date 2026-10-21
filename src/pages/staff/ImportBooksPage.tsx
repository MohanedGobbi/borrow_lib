import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiBooks } from "@/api";
import { invalidateCatalog } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { useImportFlow } from "@/hooks/useImportFlow";
import { PageHeader, Panel } from "@/components/Page";
import {
  ImportColumnsPanel, ImportConfirmBar, ImportDonePanel, ImportDropZone, ImportMissingColumns, ImportNotes,
  ImportProblem, ImportResultPanel, ImportStatTiles,
} from "@/components/ImportParts";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { TEMPLATE_HEADERS, TEMPLATE_ROWS } from "@/lib/importFile";
import type { ImportReport, ImportRow } from "@/types";

type Mode = "skip" | "update";

const CHANGE_LABEL: Record<string, string> = {
  title: "field.title", author: "field.author", category: "field.category", publisher: "field.publisher",
  year: "field.year", copies: "field.copies", shelf: "field.shelf", description: "field.description",
};
const STATUS_TONE: Record<string, string> = {
  create: "border-transparent bg-brand-soft text-brand-dark",
  update: "border-brand/40 bg-white text-brand-dark",
  unchanged: "border-border bg-white text-muted-foreground",
  skip: "border-border bg-white text-muted-foreground",
  error: "border-danger/30 bg-danger-soft text-danger",
};

export default function ImportBooksPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const flow = useImportFlow<ImportReport>();
  const [mode, setMode] = useState<Mode>("skip");
  // The real import adds and updates books (and the stock counts), so the catalog and staff lists go stale.
  const commit = useMutation({
    mutationFn: (body: { rows: Record<string, unknown>[]; mode: Mode; filename: string }) =>
      apiBooks.importRows({ ...body, dryRun: false }),
    onSuccess: () => { void invalidateCatalog(qc); },
  });
  const dry = (m: Mode) => (rows: Record<string, unknown>[], filename: string) =>
    apiBooks.importRows({ rows, mode: m, dryRun: true, filename });

  const { report, phase } = flow;
  const s = report?.summary;
  const toImport = s ? s.create + s.update : 0;
  const ignored = Object.entries(report?.columns ?? {}).filter(([, f]) => f === null).map(([h]) => h);
  const errorText = (err: ImportRow["errors"][number]) => t(`importErr.${err.code}`, err);

  const onConfirm = async () => {
    const r = await flow.confirm(
      (rows, filename) => commit.mutateAsync({ rows, mode, filename }),
      (message) => toast.error(message),
    );
    if (r) toast.success(t("import.doneBody", { c: r.summary.create, u: r.summary.update }));
  };

  return (
    <div className="space-y-6">
      <Link to="/staff/inventory" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("staff.inventory")}
      </Link>
      <PageHeader title={t("import.title")} description={t("import.sub")} />

      {phase === "done" && s ? (
        <ImportDonePanel
          body={t("import.doneBody", { c: s.create, u: s.update })}
          actions={
            <>
              <Button asChild><Link to="/staff/inventory">{t("import.toInventory")}</Link></Button>
              <Button variant="outline" onClick={flow.reset}>{t("import.another")}</Button>
            </>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel title={t("import.fileTitle")}>
            <ImportDropZone
              phase={phase} fileName={flow.fileName} inputRef={flow.inputRef} limitText={t("import.limit")}
              onFile={(file) => flow.onFile(file, dry(mode), (code) => t(`import.fileError.${code}`))}
            />
            {flow.problem && <ImportProblem message={flow.problem} />}

            <fieldset className="mt-6" disabled={flow.busy}>
              <legend className="text-sm font-semibold text-ink">{t("import.existing")}</legend>
              <RadioGroup
                value={mode}
                onValueChange={(v) => { setMode(v as Mode); flow.recheck(dry(v as Mode)); }}
                className="mt-3 gap-2.5"
              >
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

          <ImportColumnsPanel
            help={t("import.columnsHelp")} csvName="library-books-template.csv" jsonName="library-books-example.json"
            headers={TEMPLATE_HEADERS} rows={TEMPLATE_ROWS}
          />
        </div>
      )}

      {report && s && phase !== "done" && (
        report.missingColumns.length > 0 ? (
          <ImportMissingColumns list={report.missingColumns} />
        ) : (
          <>
            <ImportStatTiles
              tiles={[
                { key: "total", label: t("import.rowsInFile"), value: s.total },
                { key: "create", label: t("import.create"), value: s.create },
                { key: "update", label: t("import.update"), value: s.update },
                { key: "kept", label: t("import.unchanged"), value: s.unchanged + s.skip },
                { key: "error", label: t("import.error"), value: s.error, danger: true },
              ]}
            />

            <ImportNotes
              lines={[
                ...(ignored.length > 0 ? [t("import.ignored", { list: ignored.join(", ") })] : []),
                ...((report.newCategories ?? []).length > 0 ? [t("import.newCategories", { list: report.newCategories!.join(", ") })] : []),
              ]}
            />

            <ImportResultPanel
              rows={report.rows}
              filter={flow.filter}
              onFilter={flow.setFilter}
              counts={[["all", s.total], ["create", s.create], ["update", s.update], ["error", s.error], ["skip", s.skip], ["unchanged", s.unchanged]]}
              statusTone={STATUS_TONE}
              statusLabel={(status) => t(`import.${status}`)}
              errorText={errorText}
              columns={[
                { header: t("field.isbn"), cell: (r) => <span dir="ltr" className="whitespace-nowrap font-mono text-[13px]">{r.isbn || "—"}</span> },
                {
                  header: t("field.title"),
                  cell: (r) => (
                    <>
                      <span className="font-medium" dir="auto">{r.title || "—"}</span>
                      {r.author && <div className="text-xs text-muted-foreground"><bdi>{r.author}</bdi></div>}
                    </>
                  ),
                },
                { header: t("field.copies"), cell: (r) => r.totalCopies ?? "—", className: "tabular" },
              ]}
              extra={(r) => r.changes.length > 0 && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("import.changes", { list: r.changes.map((c) => t(CHANGE_LABEL[c] ?? c).toLowerCase()).join(", ") })}
                </p>
              )}
            />

            <ImportConfirmBar
              help={toImport === 0 ? t("import.nothing") : s.error > 0 ? t("import.confirmHelp") : null}
              hasErrors={s.error > 0}
              onErrorsCsv={() => flow.downloadErrors(errorText)}
              onConfirm={onConfirm}
              disabled={flow.busy || toImport === 0}
              importing={phase === "importing"}
              confirmLabel={t("import.confirm", { n: toImport })}
            />
          </>
        )
      )}
    </div>
  );
}
