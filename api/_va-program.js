// GET /api/va?op=school&code=<VA facility code>   (handled by api/va.js)
// One school from the VA's list, for reviewing a school that isn't in the College Scorecard.
import { vaProfile, isCode, pageUrl, schoolType } from "./_va.js";

export async function vaSchoolHandler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const code = String((req.query || {}).code || "").toUpperCase();
  if (!isCode(code)) return res.status(400).json({ error: "Invalid code" });
  let row;
  try { row = await vaProfile(code); } catch { row = null; }
  if (!row) return res.status(404).json({ error: "Program not found" });
  const debug = (req.query || {}).debug === "1";
  res.setHeader("Cache-Control", debug ? "no-store" : "s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json({ school: {
    code, school: row.displayName, city: row.city, state: row.state, country: "United States",
    schoolType: schoolType(row.type), vaUrl: pageUrl(code), website: row.website,
  }, ...(debug ? { fieldsSent: row.fields } : {}) });
}
