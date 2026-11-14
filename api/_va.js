// Shared helpers for the VA's GI Bill Comparison Tool data (the list of everything the VA
// approves: colleges, flight schools, trade and on-the-job training). This is the data behind
// VA.gov's own tool; it isn't a documented public API, so every caller has a fallback.

export const TOOL = "https://www.va.gov/education/gi-bill-comparison-tool/";
const HOSTS = ["https://api.va.gov/v1/gi/institutions", "https://api.va.gov/v0/gi/institutions"];
const HEADERS = { Accept: "application/json", "User-Agent": "GIVouch/1.0 (+https://givouch.vercel.app)" };

export const digits = (s) => String(s || "").replace(/\D/g, "");
export const norm = (s) => String(s || "").toLowerCase().replace(/\s*-\s*main campus$/i, "").replace(/[^a-z0-9]+/g, " ").trim();
export const cleanName = (v, max) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N}\s'&.,()-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
export const isCode = (c) => /^[0-9A-Z]{8}$/.test(String(c || ""));
export const pageUrl = (code) => `${TOOL}schools-and-employers/institution/${code}`;

export function searchUrl(name) {
  const n = String(name || "").replace(/\s*-\s*Main Campus$/i, "").trim();
  return n ? `${TOOL}schools-and-employers?search=name&name=${encodeURIComponent(n)}` : TOOL;
}

// VA names are in capitals: "ATP FLIGHT SCHOOL" → "ATP Flight School". Short words that
// aren't ordinary words stay capitalized as acronyms (ATP, LLC, CUNY-style names stay readable).
const SMALL = new Set(["of", "and", "the", "for", "at", "in", "on", "to", "a", "an", "de", "la", "del", "y"]);
const WORDS = new Set(["art", "air", "new", "san", "los", "las", "el", "st", "mt", "ft", "bay", "sea", "big", "inc", "co", "one", "two", "all", "way", "fly", "sky", "red", "oak", "top", "pro", "ace", "car", "bus", "tri", "my", "our", "le", "lake", "sun"]);
const title = (s) => String(s || "").split(/(\s+|-|\/)/).map((w, i) => {
  const low = w.toLowerCase();
  if (!/[a-z]/i.test(w)) return w;
  if (i > 0 && SMALL.has(low)) return low;
  if (w.length <= 3 && w === w.toUpperCase() && !WORDS.has(low) && !SMALL.has(low)) return w;
  return low.charAt(0).toUpperCase() + low.slice(1);
}).join("");

// One institution record, whatever shape the VA returns (JSON:API or plain).
export function toRow(r) {
  const a = (r && r.attributes) || r || {};
  const code = String(a.facility_code || a.facilityCode || (r && r.id) || "").toUpperCase();
  const name = String(a.name || "").trim();
  return {
    code,
    name,
    displayName: name === name.toUpperCase() ? title(name) : name,
    city: a.city ? title(a.city) : null,
    state: a.state ? String(a.state).toUpperCase().slice(0, 2) : null,
    country: a.country ? String(a.country).toUpperCase() : null,
    type: String(a.type || a.institution_type_name || a.institutionTypeName || "").toUpperCase(),
    ipeds: digits(a.cross || a.ipeds || a.iped),
    campus: String(a.campus_type || a.campusType || ""),
  };
}

export function toRows(json) {
  const list = Array.isArray(json) ? json : Array.isArray(json && json.data) ? json.data : [];
  return list.map(toRow).filter((r) => isCode(r.code) && r.name);
}

export function totalOf(json, fallback) {
  const m = (json && json.meta) || {};
  const c = m.count !== undefined ? m.count : m.total_count !== undefined ? m.total_count : m.total;
  if (typeof c === "number") return c;
  if (c && typeof c === "object") return Number(c.total || c.all || 0) || fallback;
  return fallback;
}

async function getJson(url, ms) {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(ms) });
  return { status: r.status, json: r.ok ? await r.json() : null };
}

// Search by name. Returns {rows, total, tried} — rows is [] if the VA didn't answer.
export async function vaSearch(name, page = 1, ms = 5000) {
  const tried = [];
  for (const host of HOSTS) {
    const url = `${host}/search?name=${encodeURIComponent(name)}&page=${page}`;
    try {
      const { status, json } = await getJson(url, ms);
      tried.push({ url, status });
      if (!json) continue;
      const rows = toRows(json);
      return { rows, total: totalOf(json, rows.length), tried };
    } catch (err) {
      tried.push({ url, error: String((err && err.name) || err) });
    }
  }
  return { rows: [], total: 0, tried };
}

// One institution by facility code, or null.
export async function vaProfile(code, ms = 5000) {
  if (!isCode(code)) return null;
  for (const host of HOSTS) {
    try {
      const { json } = await getJson(`${host}/${code}`, ms);
      if (!json) continue;
      const row = toRow(json.data || json);
      if (row.code === code && row.name) return row;
    } catch { /* try the next host */ }
  }
  return null;
}

// GIVouch school types for a VA institution type.
export function schoolType(t) {
  if (/FLIGHT/.test(t)) return "flight";
  if (/PUBLIC|PRIVATE|FOR PROFIT|FOREIGN/.test(t) && !/OJT/.test(t)) return "college";
  return "trade";
}
