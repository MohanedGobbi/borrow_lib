import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiUsers } from "@/api";
import { invalidateUsers } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { useImportFlow } from "@/hooks/useImportFlow";
import { PageHeader, Panel } from "@/components/Page";
import {
  ImportColumnsPanel, ImportConfirmBar, ImportDonePanel, ImportDropZone, ImportMissingColumns, ImportNotes,
  ImportProblem, ImportResultPanel, ImportStatTiles,
} from "@/components/ImportParts";
import { Button } from "@/components/ui/button";
import type { ImportRowInput } from "@/lib/importFile";
import type { StudentImportReport, StudentImportRow } from "@/types";

const TEMPLATE_HEADERS = ["name", "email", "student_id", "phone", "language"];
const TEMPLATE_ROWS = [
  ["Nadia Salem", "nadia.salem@univ.example", "20240117", "0555 12 34 56", "fr"],
  ["Omar Ben Ali", "omar.benali@univ.example", "20240118", "", "en"],
];
const STATUS_TONE: Record<string, string> = {
  create: "border-transparent bg-brand-soft text-brand-dark",
  exists: "border-border bg-white text-muted-foreground",
  error: "border-danger/30 bg-danger-soft text-danger",
};

/** Admin: create many student accounts from the enrolment list. Same flow as the book import. */
export default function ImportStudentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const flow = useImportFlow<StudentImportReport>();
  // The real import adds members, so the member lists, the counts and the activity log go stale.
  const commit = useMutation({
    mutationFn: (body: { rows: ImportRowInput[]; filename: string }) => apiUsers.importRows({ ...body, dryRun: false }),
    onSuccess: () => { void invalidateUsers(qc); },
  });
  const dry = (rows: ImportRowInput[], filename: string) => apiUsers.importRows({ rows, dryRun: true, filename });

  const { report, phase } = flow;
  const s = report?.summary;
  const toImport = s?.create ?? 0;
  const ignored = Object.entries(report?.columns ?? {}).filter(([, f]) => f === null).map(([h]) => h);
  const errorText = (err: StudentImportRow["errors"][number]) => t(`importErr.${err.code}`, err);
  const fileError = (code: "type" | "empty" | "json" | "unreadable") =>
    code === "json" ? t("sImport.fileError.json") : t(`import.fileError.${code}`);

  const onConfirm = async () => {
    const r = await flow.confirm((rows, filename) => commit.mutateAsync({ rows, filename }), (message) => toast.error(message));
    if (r) toast.success(t("sImport.doneBody", { c: r.summary.create, m: r.emailsSent }));
  };

  return (
    <div className="space-y-6">
      <Link to="/staff/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("staff.users")}
      </Link>
      <PageHeader title={t("sImport.title")} description={t("sImport.sub")} />

      {phase === "done" && s && report ? (
        <ImportDonePanel
          body={t("sImport.doneBody", { c: s.create, m: report.emailsSent })}
          note={report.emailsSent < s.create ? t("sImport.mailFailed") : undefined}
          actions={
            <>
              <Button asChild><Link to="/staff/users">{t("sImport.toMembers")}</Link></Button>
              <Button variant="outline" onClick={flow.reset}>{t("import.another")}</Button>
            </>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel title={t("import.fileTitle")}>
            <ImportDropZone
              phase={phase} fileName={flow.fileName} inputRef={flow.inputRef} limitText={t("sImport.limit")}
              onFile={(file) => flow.onFile(file, dry, fileError)}
            />
            {flow.problem && <ImportProblem message={flow.problem} />}
          </Panel>
          <ImportColumnsPanel
            help={t("sImport.columnsHelp")} csvName="library-readers-template.csv" jsonName="library-readers-example.json"
            headers={TEMPLATE_HEADERS} rows={TEMPLATE_ROWS}
          />
        </div>
      )}

      {report && s && phase !== "done" && (
        report.missingColumns.length > 0 ? (
          <ImportMissingColumns list={report.missingColumns.map((c) => (c === "studentId" ? "student_id" : c))} />
        ) : (
          <>
            <ImportStatTiles
              tiles={[
                { key: "total", label: t("import.rowsInFile"), value: s.total },
                { key: "create", label: t("import.create"), value: s.create },
                { key: "exists", label: t("sImport.exists"), value: s.exists },
                { key: "error", label: t("import.error"), value: s.error, danger: true },
              ]}
            />

            <ImportNotes lines={ignored.length > 0 ? [t("import.ignored", { list: ignored.join(", ") })] : []} />

            <ImportResultPanel
              rows={report.rows}
              filter={flow.filter}
              onFilter={flow.setFilter}
              counts={[["all", s.total], ["create", s.create], ["exists", s.exists], ["error", s.error]]}
              statusTone={STATUS_TONE}
              statusLabel={(status) => (status === "all" ? t("import.all") : status === "exists" ? t("sImport.exists") : t(`import.${status}`))}
              errorText={errorText}
              columns={[
                { header: t("col.member"), cell: (r) => <span className="font-medium" dir="auto">{r.name || "—"}</span> },
                { header: t("auth.email"), cell: (r) => <span dir="ltr" className="inline-block">{r.email || "—"}</span> },
                { header: t("col.id"), cell: (r) => <span dir="ltr" className="font-mono text-[13px]">{r.studentId || "—"}</span> },
                { header: t("nav.language"), cell: (r) => <span dir="ltr" className="inline-block">{r.language || "—"}</span> },
              ]}
            />

            <ImportConfirmBar
              help={toImport === 0 ? t("import.nothing") : s.error > 0 ? t("import.confirmHelp") : t("sImport.confirmHelp")}
              hasErrors={s.error > 0}
              onErrorsCsv={() => flow.downloadErrors(errorText)}
              onConfirm={onConfirm}
              disabled={flow.busy || toImport === 0}
              importing={phase === "importing"}
              confirmLabel={t("sImport.confirm", { n: toImport })}
            />
          </>
        )
      )}
    </div>
  );
}
