export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    if (line.trim() === "") continue;
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          fields.push(current);
          current = "";
        } else {
          current += char;
        }
      }
    }
    fields.push(current);
    rows.push(fields.map((f) => f.trim()));
  }

  return rows;
}

export function csvRowsToObjects(
  rows: string[][],
  requiredColumns: string[]
): { header: string[]; records: Record<string, string>[] } | { error: string } {
  if (rows.length === 0) return { error: "File is empty." };
  const header = rows[0];
  const missing = requiredColumns.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { error: `Missing required column(s): ${missing.join(", ")}` };
  }

  const records = rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((col, idx) => {
      record[col] = row[idx] ?? "";
    });
    return record;
  });

  return { header, records };
}