// Public settings the browser needs. Only values that are safe to show anyone go here.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null });
}
