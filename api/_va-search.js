// GET /api/va?op=search&q=<school name>   (handled by api/va.js)
// U.S. schools and training the VA approves that aren't in the College Scorecard: flight
// schools, trade schools, on-the-job training and others that don't take federal student aid
// (the Scorecard only covers schools that do). Schools with an IPEDS id are left out because
// the Scorecard search already shows them. Returns {available:false} if the VA doesn't answer.
import { vaSearch, cleanName, pageUrl, schoolType } from "./_va.js";

const MAX_PAGES = 5;

export async function vaSearchHandler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const q = cleanName((req.query || {}).q, 100);
  if (q.length < 2) return res.status(400).json({ error: "choose_something" });
  const debug = (req.query || {}).debug === "1";

  const first = await vaSearch(q, 1, 5000);
  if (!first.tried.some((t) => t.status === 200)) {
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json({ available: false, schools: [], ...(debug ? { tried: first.tried } : {}) });
  }
  let rows = first.rows;
  const per = first.rows.length;
  const pages = per ? Math.min(MAX_PAGES, Math.ceil((first.total || per) / per)) : 1;
  if (pages > 1) {
    const more = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => vaSearch(q, i + 2, 4000)));
    more.forEach((m) => { rows = rows.concat(m.rows); });
  }

  const seen = new Set();
  const schools = rows
    .filter((r) => !r.ipeds && r.type !== "FOREIGN" && (!r.country || /^(USA|UNITED STATES|US)$/.test(r.country)))
    .filter((r) => (seen.has(r.code) ? false : seen.add(r.code)))
    .map((r) => ({
      code: r.code, name: r.displayName, city: r.city, state: r.state,
      type: r.type || null, schoolType: schoolType(r.type), vaUrl: pageUrl(r.code), website: r.website,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.state).localeCompare(String(b.state)));

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({
    available: true, total: schools.length, schools,
    ...(debug ? { vaTotal: first.total, pagesRead: pages, fieldsSent: (first.rows[0] || {}).fields, sample: first.rows.slice(0, 3).map(({ fields, ...r }) => r), tried: first.tried } : {}),
  });
}
