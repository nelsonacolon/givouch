// POST /api/find-abroad {country, field, level, lang, turnstileToken}
// Schools outside the U.S. aren't in the College Scorecard, so this asks Claude to search the
// web. Results are shown as UNVERIFIED suggestions: only links that came from the actual search
// results are kept, and no contact details, amounts or approval claims are returned.
import { cleanText, turnstileOk, FIELDS } from "./_lists.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const LEVEL_NAMES = {
  certificate: "certificate", associate: "associate degree or equivalent", bachelor: "bachelor's degree",
  master: "master's degree", doctoral: "doctoral degree", grad_certificate: "graduate certificate",
};

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "not_configured" });

  const b = typeof req.body === "object" && req.body ? req.body : {};
  const country = cleanText(b.country, 60);
  if (!country || /^united states$/i.test(country)) return res.status(400).json({ error: "country" });
  const field = FIELDS.includes(b.field) && b.field !== "Other" ? b.field : "";
  const level = LEVEL_NAMES[b.level] || "";
  const lang = b.lang === "es" ? "es" : "en";

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (!(await turnstileOk(b.turnstileToken, ip))) return res.status(400).json({ error: "turnstile" });

  const prompt = `Find up to 6 schools in ${country} that offer ${level || "degree or certificate"} programs${field ? ` in ${field}` : ""} and that U.S. veterans could study at using VA education benefits (the VA approves some foreign schools for the GI Bill).

Use web search. Good searches: the VA's list of approved foreign schools for ${country}; "${country} university ${field || ""} programs in English for international students"; and the schools' official websites.

Return ONLY a JSON object, no other text:
{"schools":[{"name":"official school name","program":"specific program name or null","city":"city or null","url":"the school's official website or program page, ONLY if it appeared in your search results, else null","source":"the exact URL of a search result that mentions this school","note":"one short sentence on why it fits, in ${lang === "es" ? "Spanish" : "English"}"}]}

Rules:
- Only include schools that appear in your search results, and give the search result URL that mentions each one as "source". Never guess.
- Do not include phone numbers, emails, staff names, tuition, Yellow Ribbon amounts or any dollar figures.
- Do not state that a school is GI Bill approved unless the VA's own website says so; if unsure, say nothing about approval.
- If you find nothing reliable, return {"schools":[]}.`;

  let data;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      }),
    });
    data = await r.json();
    if (!r.ok) {
      console.error("anthropic error", r.status, JSON.stringify(data).slice(0, 300));
      return res.status(502).json({ error: "search_failed" });
    }
  } catch (err) {
    console.error("anthropic fetch failed", err);
    return res.status(502).json({ error: "search_failed" });
  }

  // Every page the search actually returned. Links not on this list are dropped.
  const sources = [];
  const seenHosts = new Set();
  const seenUrls = new Set();
  for (const block of data.content || []) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.type === "web_search_result" && /^https:\/\//.test(item.url || "")) {
          sources.push({ url: item.url, title: item.title || hostOf(item.url) });
          seenUrls.add(item.url.replace(/\/$/, ""));
          seenHosts.add(hostOf(item.url));
        }
      }
    }
  }

  const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
  let parsed = { schools: [] };
  const match = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (match) {
    try { parsed = JSON.parse(match[0]); } catch { parsed = { schools: [] }; }
  }

  const schools = (Array.isArray(parsed.schools) ? parsed.schools : []).slice(0, 6).map((s) => {
    let url = typeof s.url === "string" ? s.url.trim() : "";
    if (!/^https:\/\//.test(url) || !seenHosts.has(hostOf(url))) url = null;
    // The page that backs this school must be one the search actually returned.
    let source = typeof s.source === "string" ? s.source.trim() : "";
    const sourceOk = /^https:\/\//.test(source) &&
      (seenUrls.has(source.replace(/\/$/, "")) || seenHosts.has(hostOf(source)));
    if (!sourceOk) source = null;
    if (!source && url) source = url;
    return {
      name: cleanText(s.name, 120),
      program: cleanText(s.program, 120),
      city: cleanText(s.city, 80),
      country,
      url,
      source,
      note: cleanText(s.note, 200),
    };
  }).filter((s) => s.name && s.source); // drop anything we can't trace to a real search result

  // Only list sources that were used, to keep the panel short.
  const usedHosts = new Set(schools.map((s) => hostOf(s.source)).filter(Boolean));
  const shown = sources.filter((s, i, arr) => arr.findIndex((x) => x.url === s.url) === i)
    .sort((a, b) => (usedHosts.has(hostOf(b.url)) ? 1 : 0) - (usedHosts.has(hostOf(a.url)) ? 1 : 0))
    .slice(0, 6);

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ schools, sources: shown, unverified: true });
}
