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
