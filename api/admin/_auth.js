// Shared password check for the moderation APIs (ADMIN_TOKEN, 16+ characters).
import { timingSafeEqual, createHash } from "node:crypto";

export function adminReady() {
  const t = process.env.ADMIN_TOKEN;
  return Boolean(t && t.length >= 16);
}

export function authorized(req) {
  if (!adminReady()) return false;
  const header = req.headers.authorization || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(process.env.ADMIN_TOKEN).digest();
  return timingSafeEqual(a, b);
}
