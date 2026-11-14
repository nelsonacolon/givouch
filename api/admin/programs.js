// Moderation for suggested programs (same ADMIN_TOKEN as reviews).
//   GET  /api/admin/programs?status=pending
//   POST /api/admin/programs {id, action: "approve" | "reject"}
import { getSql } from "../_db.js";
import { adminReady, authorized } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!adminReady()) return res.status(503).json({ error: "Moderation is not set up (ADMIN_TOKEN missing or too short)" });
  if (!authorized(req)) return res.status(401).json({ error: "Wrong password" });
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: "Database not configured" });

  try {
    if (req.method === "GET") {
      const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
      const rows = await sql`
        SELECT id, school, school_type, program_name, field_of_study, format, city,
               to_jsonb(p)->>'state' AS state, country, va_listing_url, status, is_sample, created_at
        FROM programs p WHERE status = ${status}
        ORDER BY created_at ASC LIMIT 100`;
      return res.status(200).json({ programs: rows });
    }
    if (req.method === "POST") {
      const b = typeof req.body === "object" && req.body ? req.body : {};
      const id = parseInt(b.id, 10);
      const next = b.action === "approve" ? "approved" : b.action === "reject" ? "rejected" : null;
      if (!Number.isInteger(id) || id <= 0 || !next) return res.status(400).json({ error: "Invalid request" });
      const rows = await sql`UPDATE programs SET status = ${next} WHERE id = ${id} RETURNING id, status`;
      if (!rows.length) return res.status(404).json({ error: "Program not found" });
      return res.status(200).json({ ok: true, program: rows[0] });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("program moderation failed", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
