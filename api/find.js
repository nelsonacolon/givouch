// GET /api/find?field=&level=&ownership=&state=&q=&page=   (q = school name search)
// Searches U.S. schools and programs in the U.S. Department of Education's College Scorecard
// (official data), then marks which ones already have reviews on GIVouch.
// Uses SCORECARD_API_KEY if set, otherwise the shared DEMO_KEY (low limits; for testing only).
import { getSql } from "./_db.js";
import { FIELDS, US_STATES } from "./_lists.js";
import { CIP, SCORECARD as BASE, listPrograms } from "./_official.js";

// Degree levels → Scorecard credential levels.
const LEVELS = { certificate: "1", associate: "2", bachelor: "3", master: "5", doctoral: "6,7", grad_certificate: "4,8" };
const OWNERSHIP = { public: "1", nonprofit: "2", forprofit: "3" };
const PER_PAGE = 10;
const FIELDS_PARAM = [
  "id", "school.name", "school.city", "school.state", "school.school_url", "school.ownership",
  "latest.completion.completion_rate_4yr_150nt", "latest.completion.completion_rate_less_than_4yr_150nt",
  "latest.cost.avg_net_price.overall", "latest.programs.cip_4_digit",
].join(",");

const pct = (v) => (typeof v === "number" ? Math.round(v * 100) : null);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const q = req.query || {};
  const field = FIELDS.includes(q.field) && q.field !== "Other" ? q.field : "";
  const level = Object.prototype.hasOwnProperty.call(LEVELS, q.level) ? q.level : "";
  const ownership = Object.prototype.hasOwnProperty.call(OWNERSHIP, q.ownership) ? q.ownership : "";
  const state = US_STATES.includes(q.state) ? q.state : "";
  const page = Math.max(0, Math.min(50, parseInt(q.page, 10) || 0));
  const name = typeof q.q === "string" ? q.q.replace(/[^\p{L}\p{N}\s'&.,-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100) : "";
  if (name && name.length < 2) return res.status(400).json({ error: "choose_something" });
  if (!field && !level && !ownership && !state && !name) return res.status(400).json({ error: "choose_something" });

  const params = new URLSearchParams({
    api_key: process.env.SCORECARD_API_KEY || "DEMO_KEY",
    fields: FIELDS_PARAM,
    keys_nested: "true",
    per_page: String(PER_PAGE),
    page: String(page),
    sort: "latest.student.size:desc",
    "school.operating": "1",
  });
  const codes = field ? CIP[field] : [];
  if (codes.length) params.set("latest.programs.cip_4_digit.code", codes.join(","));
  if (level) params.set("latest.programs.cip_4_digit.credential.level", LEVELS[level]);
  if (ownership) params.set("school.ownership", OWNERSHIP[ownership]);
  if (state) params.set("school.state", state);
  if (name) params.set("school.name", name);

  let data;
  try {
    const r = await fetch(`${BASE}?${params}`, { headers: { Accept: "application/json" } });
    if (r.status === 429) return res.status(429).json({ error: "busy" });
    if (!r.ok) {
      console.error("scorecard error", r.status, (await r.text().catch(() => "")).slice(0, 300));
      return res.status(502).json({ error: "source_unavailable" });
    }
    data = await r.json();
  } catch (err) {
    console.error("scorecard fetch failed", err);
    return res.status(502).json({ error: "source_unavailable" });
  }

  const wantCodes = new Set(codes);
  const wantLevels = new Set(level ? LEVELS[level].split(",") : []);
  const schools = (data.results || []).map((s) => {
    const sc = s.school || {};
    const latest = s.latest || {};
    // The API returns every program a school offers. A name search lists them all (so any
    // program can be reviewed); a field or level search keeps only the matching ones.
    const nameOnly = !wantCodes.size && !wantLevels.size;
    const programs = listPrograms(latest.programs && latest.programs.cip_4_digit)
      .filter((p) => (!wantCodes.size || wantCodes.has(p.code)) && (!wantLevels.size || wantLevels.has(String(p.level))));
    if (!nameOnly) programs.splice(6);
    const done = latest.completion || {};
    const rate = pct(done.completion_rate_4yr_150nt) ?? pct(done.completion_rate_less_than_4yr_150nt);
    const net = latest.cost && latest.cost.avg_net_price ? latest.cost.avg_net_price.overall : null;
    let url = sc.school_url ? String(sc.school_url).trim() : "";
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    return {
      id: s.id,
      name: sc.name,
      city: sc.city || null,
      state: sc.state || null,
      ownership: { 1: "public", 2: "nonprofit", 3: "forprofit" }[sc.ownership] || null,
      completionRate: rate,
      avgNetPrice: typeof net === "number" ? Math.round(net) : null,
      url: url || null,
      programs,
    };
  }).filter((s) => s.name && ((!wantCodes.size && !wantLevels.size) || s.programs.length));

  // Link to GIVouch when the school is already listed here.
  const sql = getSql();
  if (sql && schools.length) {
    try {
      const names = schools.map((s) => s.name.toLowerCase());
      const rows = await sql`
        SELECT p.id, lower(p.school) AS school, p.program_name,
               (SELECT COUNT(*)::int FROM reviews r WHERE r.program_id = p.id AND r.status = 'published') AS reviews
        FROM programs p
        WHERE p.status = 'approved' AND lower(p.school) = ANY(${names}::text[])`;
      for (const s of schools) {
        s.givouch = rows.filter((r) => r.school === s.name.toLowerCase())
          .map((r) => ({ id: r.id, program: r.program_name, reviews: r.reviews }));
      }
    } catch (err) {
      console.error("givouch match failed", err);
    }
  }

  const total = data.metadata ? data.metadata.total || 0 : schools.length;
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ total, page, perPage: PER_PAGE, schools, usingDemoKey: !process.env.SCORECARD_API_KEY });
}
