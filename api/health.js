// Simple check that the serverless functions are running.
// Reports whether keys and the database are configured, never their values.
import { getSql } from "./_db.js";

export default async function handler(req, res) {
  const result = {
    ok: true,
    app: "givouch",
    anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    tablesCreated: false,
  };

  const sql = getSql();
  if (sql) {
    try {
      const rows = await sql`SELECT to_regclass('public.programs') IS NOT NULL AS has_tables`;
      result.databaseReachable = true;
      result.tablesCreated = Boolean(rows[0]?.has_tables);
    } catch (err) {
      console.error("health db check failed", err);
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(result);
}
