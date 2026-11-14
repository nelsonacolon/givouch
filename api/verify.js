// POST /api/verify {email, programId, lang, turnstileToken} — emails a 6-digit code
// before a review can be sent. Only used when email verification is turned on.
import { getSql } from "./_db.js";
import { turnstileOk, cleanText } from "./_lists.js";
import { emailVerificationOn, sendCode } from "./_email.js";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!emailVerificationOn()) return res.status(404).json({ error: "Email verification is off" });
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: "Database not configured" });

  const b = typeof req.body === "object" && req.body ? req.body : {};
  const email = cleanText(b.email, 254);
  if (!email || !EMAIL.test(email)) return res.status(400).json({ error: "invalid_email" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (!(await turnstileOk(b.turnstileToken, ip))) return res.status(400).json({ error: "turnstile" });

  try {
    const programId = parseInt(b.programId, 10);
    if (Number.isInteger(programId) && programId > 0) {
      const dupe = await sql`
        SELECT 1 FROM reviews WHERE program_id = ${programId}
          AND lower(reviewer_email) = lower(${email}) AND status <> 'rejected' LIMIT 1`;
      if (dupe.length) return res.status(409).json({ error: "duplicate" });
    }
    const result = await sendCode(sql, email, b.lang);
    if (result === "rate_limited") return res.status(429).json({ error: "rate_limited" });
    if (result === "send_failed") return res.status(502).json({ error: "send_failed" });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("verify failed", err);
    return res.status(500).json({ error: "server" });
  }
}
