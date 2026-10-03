import { useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import {
  IMPORT_MAX_ROWS, ImportFileError, downloadText, readImportFile, toCsv, type ImportRowInput,
} from "@/lib/importFile";

export type ImportPhase = "idle" | "reading" | "checking" | "preview" | "importing" | "done";

/** What every import report has in common (books and students). */
interface FlowReport {
  missingColumns: string[];
  summary: { error: number };
  rows: { row: number; status: string; errors: { code: string }[] }[];
}

type Run<R> = (rows: ImportRowInput[], fileName: string) => Promise<R>;

/**
 * The steps every bulk import screen shares: read the file, preview it on the server, confirm, and
 * download the rows with errors. The page supplies the two server calls: `dry` (preview) and `commit`.
 */
export function useImportFlow<R extends FlowReport>() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRowInput[]>([]);
  const [report, setReport] = useState<R | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const reset = () => {
    setPhase("idle"); setRows([]); setReport(null); setProblem(null); setFilter("all"); setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const check = async (data: ImportRowInput[], name: string, dry: Run<R>) => {
    setPhase("checking");
    try {
      const r = await dry(data, name);
      setReport(r);
      setFilter(r.summary.error > 0 ? "error" : "all");
      setPhase("preview");
    } catch (e) {
      setProblem(errorMessage(t, e));
      setPhase("idle");
    }
  };

  /** Read the chosen file, then preview it. `fileError` words a problem with the file itself. */
  const onFile = async (file: File | undefined, dry: Run<R>, fileError: (code: ImportFileError["code"]) => string) => {
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
      await check(data, file.name, dry);
    } catch (e) {
      setProblem(fileError(e instanceof ImportFileError ? e.code : "unreadable"));
      setPhase("idle");
    }
  };

  /** Preview the rows already read again (an option changed). */
  const recheck = (dry: Run<R>) => {
    if (rows.length) void check(rows, fileName, dry);
  };

  /** Run the real import. Returns the report, or null when it failed (the message goes to `onError`). */
  const confirm = async (commit: Run<R>, onError: (message: string) => void) => {
    setPhase("importing");
    try {
      const r = await commit(rows, fileName);
      setReport(r);
      setPhase("done");
      return r;
    } catch (e) {
      onError(errorMessage(t, e));
      setPhase("preview");
      return null;
    }
  };

  /** The rows that failed, with the file's own columns plus an `error` column, as a CSV to fix and import again. */
  const downloadErrors = (errorText: (err: R["rows"][number]["errors"][number]) => string) => {
    if (!report) return;
    const failed = new Map(report.rows.filter((r) => r.status === "error").map((r) => [r.row, r]));
    const bad = rows.filter((r) => failed.has(r.__row));
    const headers = [...new Set(bad.flatMap((r) => Object.keys(r)).filter((h) => !h.startsWith("__")))];
    const table = bad.map((r) => [...headers.map((h) => r[h]), failed.get(r.__row)!.errors.map(errorText).join(" ")]);
    downloadText(`${fileName.replace(/\.[^.]+$/, "")}-errors.csv`, toCsv([...headers, "error"], table));
  };

  const busy = phase === "reading" || phase === "checking" || phase === "importing";
  return {
    inputRef, phase, fileName, rows, report, problem, filter, setFilter, busy,
    reset, onFile, recheck, confirm, downloadErrors,
  };
}
