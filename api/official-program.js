// GET /api/official-program?school=<Scorecard id>&cip=<4 digits>&level=<1-8>
// Details of one program from official U.S. data, for reviewing a program that isn't on
// GIVouch yet. Also returns the GIVouch program ids it already matches, by format.
import { getSql } from "./_db.js";
import { fetchOfficialProgram, findProgram } from "./_official.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const q = req.query || {};
  let info;
  try {
    info = await fetchOfficialProgram(q.school, q.cip, q.level);
  } catch (err) {
    console.error("official program lookup failed", err);
    return res.status(502).json({ error: "source_unavailable" });
  }
  if (!info) return res.status(404).json({ error: "Program not found" });

  const existing = {};
  const sql = getSql();
  if (sql) {
    try {
      for (const f of ["in_person", "online"]) {
        const id = await findProgram(sql, info, f);
        if (id) existing[f] = id;
      }
    } catch (err) {
      console.error("givouch match failed", err);
    }
  }
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
  return res.status(200).json({ program: { ...info, country: "United States" }, existing });
}
