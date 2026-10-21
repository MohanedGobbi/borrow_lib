/**
 * Reads a book-import file in the browser: .xlsx, .csv or .json → rows keyed by
 * the file's own column headers. All validation happens on the server; this
 * only turns the file into data. `__row` is the row number the
 * librarian sees in their spreadsheet, so errors can point back to it.
 */
export type ImportRowInput = Record<string, unknown> & { __row: number };

export const IMPORT_ACCEPT = ".xlsx,.csv,.json";
export const IMPORT_MAX_ROWS = 5000;

export class ImportFileError extends Error {
  code: "type" | "empty" | "json" | "unreadable";
  constructor(code: ImportFileError["code"]) {
    super(code);
    this.code = code;
  }
}

export async function readImportFile(file: File): Promise<ImportRowInput[]> {
  const name = file.name.toLowerCase();
  let rows: ImportRowInput[];
  if (name.endsWith(".json")) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new ImportFileError("json");
    }
    const list = Array.isArray(data) ? data : (data as { books?: unknown; rows?: unknown })?.books ?? (data as { rows?: unknown })?.rows;
    if (!Array.isArray(list) || !list.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
      throw new ImportFileError("json");
    }
    rows = list.map((r, i) => ({ ...(r as Record<string, unknown>), __row: i + 1 }));
  } else if (name.endsWith(".csv")) {
    rows = fromTable(parseCsv(await file.text()));
  } else if (name.endsWith(".xlsx")) {
    try {
      // loaded only when someone imports an Excel file
      const { readSheet } = await import("read-excel-file/browser");
      rows = fromTable(await readSheet(file));
    } catch {
      throw new ImportFileError("unreadable");
    }
  } else {
    throw new ImportFileError("type");
  }
  if (rows.length === 0) throw new ImportFileError("empty");
  return rows;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return String(value.getFullYear());
  return String(value).trim();
}

function fromTable(table: unknown[][]): ImportRowInput[] {
  if (table.length === 0) return [];
  const headers = table[0].map(cellText);
  const rows: ImportRowInput[] = [];
  table.slice(1).forEach((cells, i) => {
    if (!cells.some((c) => cellText(c))) return; // blank spreadsheet line
    const row: ImportRowInput = { __row: i + 2 };
    headers.forEach((h, j) => {
      if (h) row[h] = cells[j] ?? null;
    });
    rows.push(row);
  });
  return rows;
}

/** RFC 4180 CSV with `,` `;` or tab delimiters (French Excel exports use `;`). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delimiter = [";", "\t", ","].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best, ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvCell(value: unknown): string {
  const text = cellText(value);
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Download text as a UTF-8 file (with BOM so Excel opens accents and Arabic correctly). */
export function downloadText(filename: string, text: string, type = "text/csv") {
  const blob = new Blob(["\uFEFF" + text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export const TEMPLATE_HEADERS = ["isbn", "title", "author", "category", "publisher", "year", "total_copies", "shelf_location", "description"];
export const TEMPLATE_ROWS = [
  ["978-0-441-17271-9", "Dune", "Frank Herbert", "Fiction", "Ace", 1990, 3, "FIC-A-09", "Science fiction classic."],
  ["978-2-07-036002-4", "L'Étranger", "Albert Camus", "Fiction", "Gallimard", 1971, 2, "FIC-C-01", ""],
];
