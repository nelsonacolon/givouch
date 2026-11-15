# GIVouch

Honest reviews of GI Bill schools and programs, written by veterans and military families, including approved schools abroad.

## Stack
- **Hosting:** Vercel (static pages + serverless functions in `/api`)
- **Code:** GitHub, branch flow `uat` → Vercel preview → `main` → production
- **AI (v2 advisor):** Claude API, key in Vercel as `ANTHROPIC_API_KEY`
- **Security:** Cloudflare (Turnstile on forms)
- **Database:** to be chosen for programs, reviews and the moderation queue

## What's here (starter)
- `index.html` — welcome page (hero, how it works, school types)
- `privacy.html`, `cookies.html` — draft policies (review before launch)
- `assets/app.js` — English/Spanish switch, light/dark toggle, cookie consent
- `assets/styles.css` — Montserrat, navy and gold
- `api/health.js` — confirms functions run and whether the API key is set

## Environment variables (Vercel → Settings → Environment Variables)
| Name | Where | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Production + Preview | From the GIVouch workspace in the Claude Console |
| `TURNSTILE_SECRET_KEY` | Production + Preview | Added with the review form |

Never commit real keys. `.env` files are ignored by git.

## Check a deployment
Open `/api/health` on the deployed site. It should show `"ok": true` and `"anthropicKeyConfigured": true`.

## Database (Neon)
1. In Vercel → Storage, create a Neon database (Free plan) connected to Production and Preview. Vercel adds `DATABASE_URL` automatically.
2. Open the database in Neon (Storage → your database → Open in Neon) → SQL Editor.
3. Paste and run `db/schema.sql`. It is safe to run again.
4. Optional, for testing only: run `db/sample-data.sql`. Every sample row is marked `is_sample`; remove them before launch with `DELETE FROM programs WHERE is_sample;`
5. Check `/api/health` shows `databaseReachable: true` and `tablesCreated: true`.

## Reviews and moderation
- Visitors write reviews at `/review?program=<id>` (the "Write a review" button on a program page).
- Every review is saved as **pending** and only appears after it is published on `/admin`.
- `/admin` needs an `ADMIN_TOKEN` environment variable in Vercel (16+ characters, mark it Sensitive). Redeploy after adding it.
- One review per email per program. A hidden field blocks simple bots. Cloudflare Turnstile is checked automatically once `TURNSTILE_SECRET_KEY` is set.

## Suggested programs
- Visitors suggest missing programs at `/add-program` (linked from Browse: "Can't find it? Add a program").
- Suggestions are saved as **pending**. Approve or reject them on `/admin` → **Programs**. Check the school against the VA's GI Bill Comparison Tool before approving.
- Fields of study come from a fixed list (`api/_lists.js`) so they can be translated.

## Email verification
- Turned on by setting `RESEND_API_KEY` in Vercel (Production and Preview), then redeploying.
- On the last step of the review form, the reviewer gets a 6-digit code by email (15 minutes, 5 tries, 3 codes per hour per email).
- Sender is `EMAIL_FROM` if set, otherwise `GIVouch <onboarding@resend.dev>`. Resend's test sender can only email the Resend account owner, so real visitors need a verified domain first.
- Codes are stored hashed in the `email_codes` table, which is created automatically.

## Find schools & programs (/find)
- **United States:** official U.S. Department of Education College Scorecard data (`api/find.js`). Set `SCORECARD_API_KEY` (free from api.data.gov) in Vercel; without it the shared `DEMO_KEY` is used, which has very low limits.
- **Abroad:** Claude web search (`api/find-abroad.js`), shown as *unverified*. Only results with a link that came from the actual search are kept; no contact details or dollar amounts. Uses `ANTHROPIC_API_KEY` (model can be changed with `ANTHROPIC_MODEL`), protected by Turnstile, up to 3 web searches per request.
- Each result links to the VA's GI Bill Comparison Tool, shows GIVouch reviews when the school is listed, and offers "Add to GIVouch" (prefills `/add-program`).

## Cache busting
Pages load `/assets/*.css` and `*.js` with `?v=<date+letter>`. After changing a file in `assets/`, bump that value in every page so browsers fetch the new copy (one replace across `*.html`).

## Function limit (Vercel Hobby)
Every file in `api/` whose name doesn't start with `_` is one serverless function, and the Hobby plan allows **12 per deployment** (more fails the build). Put new endpoints behind an `op=` parameter of an existing function, with the handler in a `_name.js` file (see `api/va.js` and `api/find.js`).
