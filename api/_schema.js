// Adds review columns that came after the first version of the schema.
// Runs once per server instance; safe to repeat.
let ready = false;
export async function ensureReviewColumns(sql) {
  if (ready) return;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS instruction_rating SMALLINT CHECK (instruction_rating BETWEEN 1 AND 5)`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS job_assistance TEXT CHECK (job_assistance IN ('very_helpful', 'somewhat_helpful', 'not_helpful', 'not_used'))`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS vet_support TEXT CHECK (vet_support IN ('helped', 'not_used', 'none', 'not_sure'))`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS yellow_ribbon TEXT CHECK (yellow_ribbon IN ('yes', 'no', 'not_eligible', 'not_sure'))`;
  ready = true;
}
