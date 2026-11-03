import type { Swimmer } from "./domain";
export function parseTime(value: string): number | undefined {
  const s = value.trim();
  if (s === "NT") return undefined;
  if (!/^(?:\d+:[0-5]\d|\d{1,2})\.\d{2}$/.test(s))
    throw Error(`Invalid time: ${value}`);
  const parts = s.split(":");
  const seconds = parts.pop()!;
  const [whole, frac] = seconds.split(".");
  if (parts.length && +whole >= 60) throw Error(`Invalid seconds: ${value}`);
  const cs = (parts.length ? +parts[0] * 6000 : 0) + +whole * 100 + +frac;
  if (!Number.isSafeInteger(cs) || cs <= 0)
    throw Error(`Invalid time: ${value}`);
  return cs;
}
export function formatTime(cs: number | undefined): string {
  if (cs === undefined) return "NT";
  if (!Number.isSafeInteger(cs) || cs <= 0) throw Error("Invalid centiseconds");
  return `${cs >= 6000 ? `${Math.floor(cs / 6000)}:` : ""}${cs >= 6000 ? String(Math.floor(cs / 100) % 60).padStart(2, "0") : Math.floor(cs / 100)}.${String(cs % 100).padStart(2, "0")}`;
}
export function importCSV(text: string): {
  swimmers: Swimmer[];
  errors: string[];
} {
  const rows: { line: number; cells: string[] }[] = [];
  let line = 1,
    start = 1,
    cell = "",
    cells: string[] = [],
    quoted = false,
    closedQuote = false;
  const errors: string[] = [];
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i] ?? "\n";
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && (cell !== "" || closedQuote)) {
        errors.push(`Row ${line}: unexpected quote`);
      } else {
        closedQuote = quoted;
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
      closedQuote = false;
    } else if (ch === "\n" && !quoted) {
      cells.push(cell.replace(/\r$/, ""));
      if (cells.some((c) => c.trim())) rows.push({ line: start, cells });
      cells = [];
      cell = "";
      closedQuote = false;
      line++;
      start = line;
    } else {
      if (closedQuote && ch !== "\r")
        errors.push(`Row ${line}: unexpected text after closing quote`);
      cell += ch;
      if (ch === "\n") line++;
    }
  }
  if (quoted) errors.push(`Row ${start}: unterminated quote`);
  const header = rows.shift()?.cells.map((c) => c.trim()) ?? [];
  const required = ["id", "name", "sex", "dob", "individualEntries"];
  if (
    required.some((h) => !header.includes(h)) ||
    new Set(header).size !== header.length
  )
    return {
      swimmers: [],
      errors: [...errors, "Row 1: missing or duplicate columns"],
    };
  const swimmers: Swimmer[] = [];
  const ids = new Set<string>();
  for (const row of rows) {
    try {
      if (row.cells.length !== header.length) throw Error("column count");
      const o = Object.fromEntries(
        header.map((h, i) => [h, row.cells[i].trim()]),
      );
      if (!o.id || !o.name || ids.has(o.id))
        throw Error("missing/duplicate ID or name");
      if (!["M", "F"].includes(o.sex)) throw Error("sex must be M or F");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(o.dob) ||
        isNaN(Date.parse(o.dob)) ||
        new Date(o.dob).toISOString().slice(0, 10) !== o.dob
      )
        throw Error("invalid DOB");
      if (
        !/^\d+$/.test(o.individualEntries) ||
        !Number.isSafeInteger(+o.individualEntries)
      )
        throw Error("invalid individual entries");
      const times: Record<string, number> = {};
      for (const h of header.filter((h) => !required.includes(h))) {
        if (!/^(free|back|breast|fly)\d+$/.test(h))
          throw Error(`unknown column ${h}`);
        const cs = parseTime(o[h]);
        if (cs !== undefined) times[h] = cs;
      }
      swimmers.push({
        id: o.id,
        name: o.name,
        sex: o.sex as "M" | "F",
        dob: o.dob,
        individualEntries: +o.individualEntries,
        times,
      });
      ids.add(o.id);
    } catch (e) {
      errors.push(`Row ${row.line}: ${(e as Error).message}`);
    }
  }
  return { swimmers: errors.length ? [] : swimmers, errors };
}
