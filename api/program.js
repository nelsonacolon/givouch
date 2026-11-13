// GET /api/program?id=123&sort=newest|highest
// One approved program, its review summary and its published reviews.
// Reviewer emails are never selected, so they can't leak into the response.
import { getSql } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = parseInt(req.query.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid program id" });

  const sql = getSql();
  if (!sql) return res.status(503).json({ error: "Database not configured" });

  const highest = req.query.sort === "highest";

  try {
    const programs = await sql`
      SELECT p.id, p.school, p.school_type, p.program_name, p.field_of_study, p.format,
             p.city, to_jsonb(p)->>'state' AS state, p.country, p.gi_bill_approved,
             p.va_listing_url, p.is_sample
      FROM programs p
      WHERE p.id = ${id} AND p.status = 'approved'
    `;
    if (!programs.length) return res.status(404).json({ error: "Program not found" });

    const summary = await sql`
      SELECT
        COUNT(*)::int AS review_count,
        ROUND(AVG(overall_rating)::numeric, 1)::float AS avg_rating,
        ROUND(AVG(paperwork_rating)::numeric, 1)::float AS avg_paperwork,
        ROUND(AVG(worth_months)::numeric, 1)::float AS avg_worth,
        ROUND(100.0 * COUNT(*) FILTER (WHERE would_recommend)
              / NULLIF(COUNT(would_recommend), 0))::int AS pct_recommend,
        ROUND(100.0 * COUNT(*) FILTER (WHERE paid_on_time IN ('always', 'usually'))
              / NULLIF(COUNT(*) FILTER (WHERE paid_on_time IN ('always', 'usually', 'rarely')), 0))::int AS pct_paid_on_time
      FROM reviews
      WHERE program_id = ${id} AND status = 'published'
    `;

    const reviews = await sql`
      SELECT id, display_name, start_year, reviewer_status, benefit, overall_rating,
             paperwork_rating, worth_months, paid_on_time, credits_transferred,
             would_recommend, job_outcome, comment, created_at, is_sample
      FROM reviews
      WHERE program_id = ${id} AND status = 'published'
      ORDER BY
        CASE WHEN ${highest} THEN overall_rating END DESC NULLS LAST,
        created_at DESC
      LIMIT 50
    `;

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({ program: programs[0], summary: summary[0], reviews });
  } catch (err) {
    console.error("program query failed", err);
    return res.status(500).json({ error: "Could not load program" });
  }
}
