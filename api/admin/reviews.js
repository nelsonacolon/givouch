// Moderation API. Requires the ADMIN_TOKEN environment variable, sent as
// "Authorization: Bearer <token>". Without ADMIN_TOKEN set, moderation is off.
//   GET  /api/admin/reviews?status=pending   → reviews waiting for a decision (includes emails)
//   POST /api/admin/reviews {id, action}     → action: "publish" or "reject"
import { getSql } from "../_db.js";
import { adminReady, authorized } from "./_auth.js";
import { ensureReviewColumns } from "../_schema.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!adminReady()) {
    return res.status(503).json({ error: "Moderation is not set up (ADMIN_TOKEN missing or too short)" });
  }
  if (!authorized(req)) return res.status(401).json({ error: "Wrong password" });

  const sql = getSql();
  if (!sql) return res.status(503).json({ error: "Database not configured" });

  try {
    await ensureReviewColumns(sql);
    if (req.method === "GET") {
      const status = ["pending", "published", "rejected"].includes(req.query.status) ? req.query.status : "pending";
      const rows = await sql`
        SELECT r.id, r.program_id, p.program_name, p.school, r.reviewer_email, r.display_name,
               r.start_year, r.reviewer_status, r.benefit, r.overall_rating, r.paperwork_rating,
               r.worth_months, r.paid_on_time, r.credits_transferred, r.would_recommend,
               r.job_outcome, r.instruction_rating, r.job_assistance, r.vet_support, r.yellow_ribbon,
               r.comment, r.status, r.created_at, r.is_sample
        FROM reviews r JOIN programs p ON p.id = r.program_id
        WHERE r.status = ${status}
        ORDER BY r.created_at ASC
        LIMIT 100`;
      return res.status(200).json({ reviews: rows });
    }

    if (req.method === "POST") {
      const b = typeof req.body === "object" && req.body ? req.body : {};
      const id = parseInt(b.id, 10);
      const next = b.action === "publish" ? "published" : b.action === "reject" ? "rejected" : null;
      if (!Number.isInteger(id) || id <= 0 || !next) return res.status(400).json({ error: "Invalid request" });
      const updated = await sql`UPDATE reviews SET status = ${next} WHERE id = ${id} RETURNING id, status`;
      if (!updated.length) return res.status(404).json({ error: "Review not found" });
      return res.status(200).json({ ok: true, review: updated[0] });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("moderation failed", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
