// GET /api/programs?q=&format=&country=&field=&sort=&offset=  (POST: suggest a program, see below)
// The state column is read with to_jsonb so this keeps working before the column is added.
// Lists approved programs with their published review count and average rating.
import { getSql } from "./_db.js";
import { FIELDS, US_STATES, cleanText, turnstileOk } from "./_lists.js";

const FORMATS = new Set(["online", "in_person", "abroad"]);
const PAGE_SIZE = 20;

function clean(value, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const SCHOOL_TYPES = new Set(["college", "trade", "flight"]);

// POST /api/programs — a visitor suggests a missing program. It is saved as "pending"
// and only shows on the site after it is approved on the moderation page.
async function suggest(req, res, sql) {
  const b = typeof req.body === "object" && req.body ? req.body : {};
  if (b.website) return res.status(201).json({ ok: true }); // honeypot

  const school = cleanText(b.school, 120);
  const programName = cleanText(b.programName, 120);
  const country = cleanText(b.country, 60);
  const city = cleanText(b.city, 80);
  const isUS = country === "United States";
  const state = isUS ? cleanText(b.state, 2) : null;
  let vaUrl = cleanText(b.vaUrl, 300);

  const errors = [];
  if (!school || school.length < 2) errors.push("school");
  if (!programName || programName.length < 2) errors.push("programName");
  if (!SCHOOL_TYPES.has(b.schoolType)) errors.push("schoolType");
  if (!FORMATS.has(b.format)) errors.push("format");
  if (!FIELDS.includes(b.field)) errors.push("field");
  if (!country) errors.push("country");
  if (isUS && b.format !== "online" && !US_STATES.includes(state)) errors.push("state");
  if (isUS && b.format === "abroad") errors.push("format");
  if (vaUrl) {
    try {
      const u = new URL(vaUrl);
      if (u.protocol !== "https:") throw new Error("not https");
      vaUrl = u.href;
    } catch {
      errors.push("vaUrl");
    }
  }
  if (errors.length) return res.status(400).json({ error: "Please check the details", fields: errors });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (!(await turnstileOk(b.turnstileToken, ip))) {
    return res.status(400).json({ error: "Security check failed", fields: ["turnstile"] });
  }

  try {
    const existing = await sql`
      SELECT id, status FROM programs
      WHERE lower(school) = lower(${school}) AND lower(program_name) = lower(${programName})
        AND status <> 'rejected'
      LIMIT 1`;
    if (existing.length) {
      return res.status(409).json({ error: "duplicate", id: existing[0].status === "approved" ? existing[0].id : null });
    }
    const hasState = await sql`
      SELECT 1 FROM information_schema.columns WHERE table_name = 'programs' AND column_name = 'state'`;
    const rows = hasState.length
      ? await sql`
          INSERT INTO programs (school, school_type, program_name, field_of_study, format, city, state, country,
                                gi_bill_approved, va_listing_url, status)
          VALUES (${school}, ${b.schoolType}, ${programName}, ${b.field}, ${b.format}, ${city}, ${state}, ${country},
                  TRUE, ${vaUrl}, 'pending')
          RETURNING id`
      : await sql`
          INSERT INTO programs (school, school_type, program_name, field_of_study, format, city, country,
                                gi_bill_approved, va_listing_url, status)
          VALUES (${school}, ${b.schoolType}, ${programName}, ${b.field}, ${b.format}, ${city}, ${country},
                  TRUE, ${vaUrl}, 'pending')
          RETURNING id`;
    return res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("program suggest failed", err);
    return res.status(500).json({ error: "Could not save the program" });
  }
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const sqlPost = getSql();
    if (!sqlPost) return res.status(503).json({ error: "Database not configured" });
    return suggest(req, res, sqlPost);
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sql = getSql();
  if (!sql) return res.status(503).json({ error: "Database not configured" });

  const q = clean(req.query.q);
  const country = clean(req.query.country);
  const field = clean(req.query.field);
  const formats = clean(req.query.format, 60).split(",").filter((f) => FORMATS.has(f));
  const sort = req.query.sort === "rating" ? "rating" : "reviewed";
  const offset = Math.max(0, Math.min(10000, parseInt(req.query.offset, 10) || 0));

  const like = q ? `%${q}%` : null;

  try {
    const rows = await sql`
      SELECT p.id, p.school, p.school_type, p.program_name, p.field_of_study, p.format,
             p.city, to_jsonb(p)->>'state' AS state, p.country, p.gi_bill_approved, p.is_sample,
             COUNT(r.id)::int AS review_count,
             ROUND(AVG(r.overall_rating)::numeric, 1)::float AS avg_rating,
             COUNT(*) OVER()::int AS total
      FROM programs p
      LEFT JOIN reviews r ON r.program_id = p.id AND r.status = 'published'
      WHERE p.status = 'approved'
        AND (${like}::text IS NULL OR p.school ILIKE ${like} OR p.program_name ILIKE ${like}
             OR p.field_of_study ILIKE ${like} OR p.country ILIKE ${like} OR p.city ILIKE ${like}
             OR to_jsonb(p)->>'state' ILIKE ${like})
        AND (${country || null}::text IS NULL OR p.country = ${country || null})
        AND (${field || null}::text IS NULL OR p.field_of_study = ${field || null})
        AND (cardinality(${formats}::text[]) = 0 OR p.format = ANY(${formats}::text[]))
      GROUP BY p.id
      ORDER BY
        CASE WHEN ${sort} = 'rating' THEN COALESCE(AVG(r.overall_rating), 0) END DESC NULLS LAST,
        COUNT(r.id) DESC, p.program_name ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `;

    const filters = await sql`
      SELECT
        COALESCE(array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL), '{}') AS countries,
        COALESCE(array_agg(DISTINCT field_of_study) FILTER (WHERE field_of_study IS NOT NULL), '{}') AS fields
      FROM programs WHERE status = 'approved'
    `;

    const total = rows.length ? rows[0].total : 0;
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({
      total,
      pageSize: PAGE_SIZE,
      offset,
      programs: rows.map(({ total: _t, ...p }) => p),
      countries: (filters[0]?.countries || []).sort(),
      fields: (filters[0]?.fields || []).sort(),
    });
  } catch (err) {
    console.error("programs query failed", err);
    return res.status(500).json({ error: "Could not load programs" });
  }
}
