import type { ImportRow } from "./types";

// Reads what someone copies out of Excel / Google Sheets (tab separated) or
// saves as CSV (comma or semicolon). The first line is the header; columns are
// matched by name, in any order, so a founder's own sheet works as it is.
const ALIASES: Record<keyof Omit<ImportRow, never>, string[]> = {
  name: ["name", "client", "member", "full name", "الاسم"],
  phone: ["phone", "mobile", "number", "whatsapp", "tel", "رقم"],
  email: ["email", "e-mail", "mail"],
  plan: ["plan", "package", "membership", "subscription", "type"],
  startsOn: ["start", "starts", "start date", "from", "joined"],
  expiresOn: ["end", "ends", "expiry", "expires", "expiry date", "end date", "until", "to", "renewal"],
  creditsLeft: ["sessions left", "left", "remaining", "classes left", "sessions remaining"],
  creditsTotal: ["sessions", "total sessions", "classes", "total", "pack size"],
};

function splitLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === d && !q) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** 2026-11-30, 30/11/2026, 30-11-26 (day first, as written in Egypt) -> 2026-11-30. */
export function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return valid(y, m, d);
  }
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(y, Number(m[2]), Number(m[1]));
  }
  return null;
}
function valid(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface ParsedImport {
  rows: ImportRow[];
  problems: { row: number; text: string }[];
  recognised: string[];
}

export function parseImport(text: string): ParsedImport {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], problems: [], recognised: [] };
  const head = lines[0];
  const delim = head.includes("\t") ? "\t" : head.split(";").length > head.split(",").length ? ";" : ",";
  const cols = splitLine(head, delim).map((h) => h.toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, "").trim());
  const idx: Partial<Record<keyof ImportRow, number>> = {};
  (Object.keys(ALIASES) as (keyof ImportRow)[]).forEach((k) => {
    const exact = cols.findIndex((c) => ALIASES[k].includes(c));
    if (exact >= 0) idx[k] = exact;
  });
  const recognised = (Object.keys(idx) as (keyof ImportRow)[]).filter((k) => idx[k] !== undefined);
  const problems: { row: number; text: string }[] = [];
  if (idx.name === undefined) return { rows: [], problems: [{ row: 1, text: "The first row needs a column called Name." }], recognised };

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const get = (k: keyof ImportRow) => (idx[k] === undefined ? "" : (cells[idx[k]!] ?? "").trim());
    const r: ImportRow = { name: get("name") };
    if (get("phone")) r.phone = get("phone");
    if (get("email")) r.email = get("email");
    if (get("plan")) r.plan = get("plan");
    const start = get("startsOn");
    if (start) {
      const d = toIsoDate(start);
      if (d) r.startsOn = d; else problems.push({ row: i, text: `Start date "${start}" isn't a date (use 30/11/2026 or 2026-11-30).` });
    }
    const end = get("expiresOn");
    if (end) {
      const d = toIsoDate(end);
      if (d) r.expiresOn = d; else problems.push({ row: i, text: `Expiry "${end}" isn't a date (use 30/11/2026 or 2026-11-30).` });
    }
    const left = get("creditsLeft");
    if (left !== "") {
      const n = Number(left);
      if (Number.isInteger(n) && n >= 0) r.creditsLeft = n; else problems.push({ row: i, text: `"${left}" isn't a number of sessions.` });
    }
    const total = get("creditsTotal");
    if (total !== "") {
      const n = Number(total);
      if (Number.isInteger(n) && n > 0) r.creditsTotal = n;
    }
    if (!r.name) { problems.push({ row: i, text: "No name." }); continue; }
    rows.push(r);
  }
  return { rows, problems, recognised };
}

export const TEMPLATE_CSV = "Name,Phone,Plan,Start,Expiry,Sessions left,Sessions\nMona Ali,01012345678,Monthly,01/10/2026,01/11/2026,,\nOmar Said,01099999999,10-class pack,15/09/2026,15/12/2026,4,10\n";
