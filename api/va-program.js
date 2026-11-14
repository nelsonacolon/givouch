// GET /api/va-program?code=<VA facility code>
// One school from the VA's list, for reviewing a school that isn't in the College Scorecard.
import { vaProfile, isCode, pageUrl, schoolType } from "./_va.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const code = String((req.query || {}).code || "").toUpperCase();
  if (!isCode(code)) return res.status(400).json({ error: "Invalid code" });
  let row;
  try { row = await vaProfile(code); } catch { row = null; }
  if (!row) return res.status(404).json({ error: "Program not found" });
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ school: {
    code, school: row.displayName, city: row.city, state: row.state, country: "United States",
    schoolType: schoolType(row.type), vaUrl: pageUrl(code),
  } });
}
