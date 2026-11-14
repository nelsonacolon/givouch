// GET /api/va?id=<IPEDS id>&name=<school name>&state=<ST>[&debug=1]
// Sends the visitor straight to the school's page in the VA's GI Bill Comparison Tool.
// It looks the school up in the data behind that tool and picks the VA facility code whose
// IPEDS id matches (the College Scorecard id is the IPEDS id), else an exact name + state match.
// If nothing matches, or the VA's service is down or changes, it falls back to the tool's
// name search, so the button always works. debug=1 returns JSON instead of redirecting.

import { TOOL, searchUrl, toRows, cleanName as clean, norm, digits } from "./_va.js";

const SEARCH_URLS = [
  (n) => `https://api.va.gov/v1/gi/institutions/search?name=${encodeURIComponent(n)}`,
  (n) => `https://api.va.gov/v0/gi/institutions/search?name=${encodeURIComponent(n)}`,
];
const rows = toRows;

// Main campus first: VA marks branches as extensions.
const mainFirst = (a, b) => (/^e/i.test(a.campus) ? 1 : 0) - (/^e/i.test(b.campus) ? 1 : 0);

export default async function handler(req, res) {
  const q = req.query || {};
  const id = digits(q.id).slice(0, 10);
  const name = clean(q.name, 120);
  const state = clean(q.state, 2).toUpperCase();
  const debug = q.debug === "1";
  const fallback = searchUrl(name);
  const tried = [];
  let match = null, how = null, candidates = [];

  // Names differ a little between agencies ("CUNY John Jay…", "…-Main Campus"), so try variants.
  const base = name.replace(/\s*-\s*Main Campus$/i, "").trim();
  const variants = [...new Set([
    base,
    base.replace(/\s+-\s+.*$/, "").trim(),
    base.replace(/^(CUNY|SUNY)\s+/i, "").trim(),
  ])].filter((v) => v.length >= 2);

  const deadline = Date.now() + 7000; // never keep the visitor waiting long
  outer: for (const lookup of variants) {
    for (const make of SEARCH_URLS) {
      const left = deadline - Date.now();
      if (left < 500) break outer;
      const url = make(lookup);
      try {
        const r = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "GIVouch/1.0 (+https://givouch.vercel.app)" },
          signal: AbortSignal.timeout(Math.min(4000, left)),
        });
        tried.push({ url, status: r.status });
        if (!r.ok) continue;
        candidates = rows(await r.json());
        if (!candidates.length) break; // this endpoint works; try the next name variant
        const names = new Set(variants.map(norm));
        const byIpeds = id ? candidates.filter((c) => c.ipeds && c.ipeds === id).sort(mainFirst) : [];
        const byName = candidates.filter((c) => names.has(norm(c.name)) && (!state || c.state.toUpperCase() === state)).sort(mainFirst);
        if (byIpeds.length) { match = byIpeds[0]; how = "ipeds"; break outer; }
        if (byName.length) { match = byName[0]; how = "name_state"; break outer; }
        break;
      } catch (err) {
        tried.push({ url, error: String((err && err.name) || err) });
      }
    }
  }

  const target = match ? `${TOOL}schools-and-employers/institution/${match.code}` : fallback;
  if (debug) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ target, matched: match, how, tried, candidates: candidates.slice(0, 10) });
  }
  // Cache found pages for a day; retry misses sooner.
  res.setHeader("Cache-Control", match ? "s-maxage=86400, stale-while-revalidate=604800" : "s-maxage=3600");
  res.setHeader("Location", target);
  return res.status(302).end();
}
