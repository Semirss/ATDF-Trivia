export type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  if (typeof window === "undefined") {
    return;
  }

  const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function csvTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
