// GET /api/programs?q=&format=&country=&field=&sort=&offset=
// The state column is read with to_jsonb so this keeps working before the column is added.
// Lists approved programs with their published review count and average rating.
import { getSql } from "./_db.js";

const FORMATS = new Set(["online", "in_person", "abroad"]);
const PAGE_SIZE = 20;

function clean(value, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
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
