// POST /api/reviews — save a new review. Every review starts as "pending" and only
// appears on the site after it is approved on the moderation page.
import { getSql } from "./_db.js";
import { turnstileOk } from "./_lists.js";
import { emailVerificationOn, checkCode } from "./_email.js";
import { ensureReviewColumns } from "./_schema.js";
import { fetchOfficialProgram, findProgram, createProgram } from "./_official.js";

const STARS = (v) => Number.isInteger(v) && v >= 1 && v <= 5;
const ONE_OF = (list) => (v) => list.includes(v);
const REVIEWER = ONE_OF(["veteran", "service_member", "spouse", "child"]);
const PAID = ONE_OF(["always", "usually", "rarely", "not_applicable"]);
const CREDITS = ONE_OF(["yes", "partly", "no", "not_applicable"]);
const JOB = ONE_OF(["field", "other_field", "studying", "looking", "not_looking"]);
const BENEFIT = ONE_OF(["post911", "montgomery", "vre", "dea", "other"]);
const JOB_HELP = ONE_OF(["very_helpful", "somewhat_helpful", "not_helpful", "not_used"]);
const VET_SUPPORT = ONE_OF(["helped", "not_used", "none", "not_sure"]);
const YELLOW = ONE_OF(["yes", "no", "not_eligible", "not_sure"]);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function text(v, max) {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  return t ? t.slice(0, max) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: "Database not configured" });

  const b = typeof req.body === "object" && req.body ? req.body : {};

  // Honeypot: a hidden field people never see. Bots fill it in.
  if (b.website) return res.status(201).json({ ok: true });

  const errors = [];
  let programId = parseInt(b.programId, 10);
  // A program from official U.S. data that may not be on GIVouch yet: {school, cip, level, format}.
  const off = !programId && b.official && typeof b.official === "object" ? b.official : null;
  if (off) {
    if (!["online", "in_person"].includes(off.format)) errors.push("format");
  } else if (!Number.isInteger(programId) || programId <= 0) errors.push("programId");

  const overall = Number(b.overall), paperwork = Number(b.paperwork), worth = Number(b.worth);
  if (!STARS(overall)) errors.push("overall");
  if (!STARS(paperwork)) errors.push("paperwork");
  if (!STARS(worth)) errors.push("worth");
  const instruction = Number(b.instruction);
  if (!STARS(instruction)) errors.push("instruction");
  if (!JOB_HELP(b.jobHelp)) errors.push("jobHelp");
  if (!VET_SUPPORT(b.vetSupport)) errors.push("vetSupport");
  if (!YELLOW(b.yellowRibbon)) errors.push("yellowRibbon");
  if (typeof b.recommend !== "boolean") errors.push("recommend");
  if (!PAID(b.paidOnTime)) errors.push("paidOnTime");
  if (!CREDITS(b.credits)) errors.push("credits");
  if (!JOB(b.job)) errors.push("job");
  if (!REVIEWER(b.reviewer)) errors.push("reviewer");
  if (!BENEFIT(b.benefit)) errors.push("benefit");

  const thisYear = new Date().getFullYear();
  const startYear = b.startYear === null || b.startYear === "" || b.startYear === undefined ? null : parseInt(b.startYear, 10);
  if (startYear !== null && (!Number.isInteger(startYear) || startYear < 1944 || startYear > thisYear)) errors.push("startYear");

  const email = text(b.email, 254);
  if (!email || !EMAIL.test(email)) errors.push("email");
  if (b.attest !== true) errors.push("attest");

  const comment = text(b.comment, 2000);
  const displayName = text(b.displayName, 40);

  if (errors.length) return res.status(400).json({ error: "Please check your answers", fields: errors });

  // With email verification on, the code proves the email is real (and the bot check
  // already ran when the code was sent). Otherwise, check the bot check here.
  const verifying = emailVerificationOn();
  if (!verifying) {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (!(await turnstileOk(b.turnstileToken, ip))) {
      return res.status(400).json({ error: "Security check failed", fields: ["turnstile"] });
    }
  }

  try {
    await ensureReviewColumns(sql);
    let info = null;
    if (off) {
      // Re-check the school and program against the official data; never trust the browser.
      try {
        info = await fetchOfficialProgram(off.school, off.cip, off.level);
      } catch (err) {
        console.error("official program lookup failed", err);
        return res.status(502).json({ error: "source_unavailable" });
      }
      if (!info) return res.status(404).json({ error: "Program not found" });
      programId = await findProgram(sql, info, off.format);
    } else {
      const program = await sql`SELECT id FROM programs WHERE id = ${programId} AND status = 'approved'`;
      if (!program.length) return res.status(404).json({ error: "Program not found" });
    }

    // One review per email per program (published or waiting).
    if (programId) {
      const dupe = await sql`
        SELECT 1 FROM reviews
        WHERE program_id = ${programId} AND lower(reviewer_email) = lower(${email}) AND status <> 'rejected'
        LIMIT 1`;
      if (dupe.length) return res.status(409).json({ error: "duplicate", fields: ["email"] });
    }

    if (verifying) {
      const check = await checkCode(sql, email, typeof b.code === "string" ? b.code.trim() : "");
      if (check !== "ok") return res.status(400).json({ error: "code_" + check, fields: ["code"] });
    }

    // First review of this program: add it to GIVouch now.
    if (!programId) programId = await createProgram(sql, info, off.format);

    const inserted = await sql`
      INSERT INTO reviews (program_id, reviewer_email, display_name, attested_at, start_year, reviewer_status,
        benefit, overall_rating, paperwork_rating, worth_months, paid_on_time, credits_transferred,
        would_recommend, job_outcome, instruction_rating, job_assistance, vet_support, yellow_ribbon, comment, status)
      VALUES (${programId}, ${email}, ${displayName}, now(), ${startYear}, ${b.reviewer},
        ${b.benefit}, ${overall}, ${paperwork}, ${worth}, ${b.paidOnTime}, ${b.credits},
        ${b.recommend}, ${b.job}, ${instruction}, ${b.jobHelp}, ${b.vetSupport}, ${b.yellowRibbon}, ${comment}, 'pending')
      RETURNING id`;
    return res.status(201).json({ ok: true, id: inserted[0].id, programId });
  } catch (err) {
    console.error("review insert failed", err);
    return res.status(500).json({ error: "Could not save your review" });
  }
}
