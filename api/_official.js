// Shared helpers for programs taken from the U.S. Department of Education's College Scorecard.
// A visitor can review any program a school offers there, even before it is on GIVouch:
// the server re-checks the school and program against the official data (so nothing the
// visitor sends is trusted), and adds the program to GIVouch when the first review is sent.

export const SCORECARD = "https://api.data.gov/ed/collegescorecard/v1/schools";

// Fields of study → 4-digit CIP codes (federal program classification).
export const CIP = {
  "Accounting": ["5203"], "Agriculture": ["0101", "0109", "0111"], "Architecture": ["0402"],
  "Arts": ["5004", "5007", "5009"], "Automotive": ["4706"], "Aviation": ["4901"], "Biology": ["2601"],
  "Business": ["5201", "5202"], "Communications": ["0901", "0904"], "Computer science": ["1101", "1107"],
  "Construction": ["4601", "4602", "4603", "4604", "4605", "5220"], "Criminal justice": ["4301"],
  "Culinary arts": ["1205"], "Cybersecurity": ["1110", "4303"], "Education": ["1301", "1312", "1313"],
  "Engineering": ["1401", "1408", "1409", "1410", "1419"], "Finance": ["5208"],
  "Health care": ["5107", "5108", "5109", "5100"], "History": ["5401"], "Hospitality": ["5209"],
  "Information technology": ["1101", "1103", "1110"], "Languages": ["1601", "1609"],
  "Law": ["2201", "2203"], "Liberal arts": ["2401"], "Management": ["5202"], "Marketing": ["5214"],
  "Mathematics": ["2701"], "Nursing": ["5138", "5139"], "Psychology": ["4201", "4228"],
  "Public administration": ["4404"], "Science": ["4001", "4005", "4008"],
  "Skilled trades": ["4702", "4706", "4805", "4603", "4605"], "Social work": ["4407"], "Welding": ["4805"],
};

// Scorecard credential levels → names used in program titles on GIVouch.
export const CREDENTIAL = {
  1: "Certificate", 2: "Associate's Degree", 3: "Bachelor's Degree", 4: "Post-baccalaureate Certificate",
  5: "Master's Degree", 6: "Doctoral Degree", 7: "First Professional Degree", 8: "Graduate Certificate",
};

export const strip = (c) => String(c || "").replace(/\D/g, "");

export function fieldForCode(code) {
  const c = strip(code).slice(0, 4);
  for (const [field, codes] of Object.entries(CIP)) if (codes.includes(c)) return field;
  return "Other";
}

// Every program a school offers (one entry per program and degree level), sorted by level then name.
export function listPrograms(all) {
  const seen = new Set();
  return (all || [])
    .map((p) => ({
      code: strip(p.code).slice(0, 4),
      title: String(p.title || "").replace(/\.$/, "").trim(),
      level: p.credential ? Number(p.credential.level) || null : null,
      credential: p.credential ? p.credential.title || null : null,
      distance: p.distance === undefined || p.distance === null ? null : Number(p.distance),
    }))
    .filter((p) => {
      const k = p.code + "|" + p.level;
      if (!p.title || p.code.length !== 4 || !p.level || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
}

export function programName(p) {
  return `${p.title} (${CREDENTIAL[p.level] || p.credential || "Program"})`;
}

// Looks up one school and one of its programs. Returns null if either doesn't exist.
export async function fetchOfficialProgram(schoolId, code, level) {
  const id = parseInt(schoolId, 10);
  const c = strip(code);
  const lv = parseInt(level, 10);
  if (!Number.isInteger(id) || id <= 0 || c.length !== 4 || !CREDENTIAL[lv]) return null;
  const params = new URLSearchParams({
    api_key: process.env.SCORECARD_API_KEY || "DEMO_KEY",
    id: String(id),
    fields: "id,school.name,school.city,school.state,latest.programs.cip_4_digit",
    keys_nested: "true",
  });
  const r = await fetch(`${SCORECARD}?${params}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("scorecard " + r.status);
  const d = await r.json();
  const s = (d.results || [])[0];
  if (!s || !s.school || !s.school.name) return null;
  const all = listPrograms(s.latest && s.latest.programs && s.latest.programs.cip_4_digit);
  const p = all.find((x) => x.code === c && x.level === lv);
  if (!p) return null;
  return {
    schoolId: id,
    school: String(s.school.name).slice(0, 200),
    city: s.school.city ? String(s.school.city).slice(0, 100) : null,
    state: s.school.state ? String(s.school.state).slice(0, 40) : null,
    code: p.code,
    level: p.level,
    programName: programName(p).slice(0, 200),
    field: fieldForCode(p.code),
  };
}

// The matching GIVouch program, if it is already listed (same school, program and format).
export async function findProgram(sql, info, format) {
  const rows = await sql`
    SELECT id FROM programs
    WHERE status = 'approved' AND lower(school) = lower(${info.school})
      AND lower(program_name) = lower(${info.programName}) AND format = ${format}
    ORDER BY id LIMIT 1`;
  return rows.length ? rows[0].id : null;
}

export async function createProgram(sql, info, format) {
  const existing = await findProgram(sql, info, format);
  if (existing) return existing;
  const rows = await sql`
    INSERT INTO programs (school, school_type, program_name, field_of_study, format, city, state, country,
                          gi_bill_approved, status)
    VALUES (${info.school}, 'college', ${info.programName}, ${info.field}, ${format}, ${info.city}, ${info.state},
            'United States', FALSE, 'approved')
    RETURNING id`;
  return rows[0].id;
}
