// Fixed lists shared by the API. Fields of study use these exact English names;
// the browser translates them for display (assets/labels.js).
export const FIELDS = [
  "Accounting", "Agriculture", "Architecture", "Arts", "Automotive", "Aviation", "Biology",
  "Business", "Communications", "Computer science", "Construction", "Criminal justice",
  "Culinary arts", "Cybersecurity", "Education", "Engineering", "Finance", "Health care",
  "History", "Hospitality", "Information technology", "Languages", "Law", "Liberal arts",
  "Management", "Marketing", "Mathematics", "Nursing", "Psychology", "Public administration",
  "Science", "Skilled trades", "Social work", "Welding", "Other",
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR",
  "PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","GU","VI","AS","MP",
];

export function cleanText(v, max) {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

export async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip || "" }),
    });
    return Boolean((await r.json()).success);
  } catch {
    return false;
  }
}
