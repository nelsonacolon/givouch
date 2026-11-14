// Email verification codes. Turned on when RESEND_API_KEY is set in Vercel.
import { createHmac, randomInt } from "node:crypto";

export const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 3;

export function emailVerificationOn() {
  return Boolean(process.env.RESEND_API_KEY);
}

function hashCode(email, code) {
  const secret = process.env.CODE_SECRET || process.env.ADMIN_TOKEN || process.env.RESEND_API_KEY || "givouch";
  return createHmac("sha256", secret).update(email.toLowerCase() + ":" + code).digest("hex");
}

let tableReady = false;
async function ensureTable(sql) {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS email_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts SMALLINT NOT NULL DEFAULT 0,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS email_codes_email_idx ON email_codes (lower(email), created_at)`;
  tableReady = true;
}

const TEXT = {
  en: {
    subject: (c) => `${c} is your GIVouch code`,
    body: (c) => `Your GIVouch verification code is ${c}\n\nEnter it on the review form to send your review. It expires in ${CODE_MINUTES} minutes.\n\nIf you didn't ask for this, you can ignore this email.\n\nGIVouch — honest reviews of programs paid for with veterans benefits, by veterans and military families`,
  },
  es: {
    subject: (c) => `${c} es tu código de GIVouch`,
    body: (c) => `Tu código de verificación de GIVouch es ${c}\n\nIngrésalo en el formulario para enviar tu reseña. Vence en ${CODE_MINUTES} minutos.\n\nSi no lo pediste, puedes ignorar este correo.\n\nGIVouch — reseñas honestas de programas pagados con beneficios de veterano, por veteranos y familias militares`,
  },
};

// Creates a code and emails it. Returns "sent", "rate_limited" or "send_failed".
export async function sendCode(sql, email, lang) {
  await ensureTable(sql);
  // Housekeeping: codes are only needed briefly, so remove ones older than a day.
  await sql`DELETE FROM email_codes WHERE created_at < now() - interval '1 day'`;
  const recent = await sql`
    SELECT COUNT(*)::int AS n FROM email_codes
    WHERE lower(email) = lower(${email}) AND created_at > now() - interval '1 hour'`;
  if (recent[0].n >= MAX_CODES_PER_HOUR) return "rate_limited";

  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  await sql`
    INSERT INTO email_codes (email, code_hash, expires_at)
    VALUES (${email}, ${hashCode(email, code)}, now() + make_interval(mins => ${CODE_MINUTES}))`;

  const t = TEXT[lang === "es" ? "es" : "en"];
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "GIVouch <onboarding@resend.dev>",
        to: [email],
        subject: t.subject(code),
        text: t.body(code),
      }),
    });
    if (!r.ok) {
      console.error("resend failed", r.status, await r.text().catch(() => ""));
      return "send_failed";
    }
    return "sent";
  } catch (err) {
    console.error("resend error", err);
    return "send_failed";
  }
}

// Checks a code and marks it used. Returns "ok", "wrong", "expired" or "too_many".
export async function checkCode(sql, email, code) {
  await ensureTable(sql);
  const rows = await sql`
    SELECT id, code_hash, attempts, expires_at > now() AS live FROM email_codes
    WHERE lower(email) = lower(${email}) AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1`;
  if (!rows.length || !rows[0].live) return "expired";
  const row = rows[0];
  if (row.attempts >= MAX_ATTEMPTS) return "too_many";
  if (typeof code !== "string" || !/^\d{6}$/.test(code) || hashCode(email, code) !== row.code_hash) {
    await sql`UPDATE email_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return row.attempts + 1 >= MAX_ATTEMPTS ? "too_many" : "wrong";
  }
  await sql`UPDATE email_codes SET used_at = now() WHERE id = ${row.id}`;
  return "ok";
}
