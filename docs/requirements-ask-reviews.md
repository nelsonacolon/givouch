# Ask the reviews (RAG, v1)

**Status:** UAT · **Owner:** Nelson Colon · **Nov 2026**

## Goal
Let visitors ask a plain-language question about a program and get a short answer that is grounded only in that program's published GIVouch reviews, with links to the reviews it used.

This is retrieval-augmented generation (RAG): the site retrieves the program's reviews from the database, gives them to Claude with the question, and Claude answers from those reviews only.

## User story
As a veteran or family member looking at a program, I want to ask a question such as "Do they pay housing on time?" and get an answer based on what other veterans said, so I don't have to read every review.

## Scope (v1)
- A "Ask about this program" box on the program page (`/program?id=…`), shown only when the program has at least 1 published review.
- Retrieval is a normal SQL query: the program's **published** reviews (newest 40), plus the summary numbers already on the page. No vector search in v1.
- English and Spanish, following the site's language switch.

## Requirements
| # | Requirement |
| --- | --- |
| R1 | Answers use only the program's published reviews. Pending and rejected reviews are never sent to the AI. |
| R2 | Reviewer emails are never selected or sent to the AI. |
| R3 | Every answer lists the reviews it relied on; each citation links to that review on the page. Citations the AI makes up (numbers that don't match a sent review) are dropped. |
| R4 | If the reviews don't cover the question, the answer says so instead of guessing. |
| R5 | When fewer than 3 reviews exist, the answer is labeled as based on a small number of reviews. |
| R6 | No legal, financial or benefits-eligibility advice; the existing "confirm with the SCO and VA.gov" notice stays on the page. |
| R7 | Review text is treated as data, not instructions (protects against reviews that try to steer the AI). |
| R8 | Question length 3–300 characters. Protected by Cloudflare Turnstile when it's configured. |
| R9 | Answers are labeled "AI summary of reviews" and are not stored. |
| R10 | Stays within Vercel Hobby's 12-function limit: served by `POST /api/program?op=ask`, handler in `api/_ask.js`. |

## Out of scope (later)
- Vector search (pgvector + embeddings) across all programs.
- Comparing two programs.
- Saving or rating answers.

## UAT test cases
| # | Steps | Expected |
| --- | --- | --- |
| T1 | Open a program with reviews; ask "Would people recommend it?" | Short answer with 1+ review links; clicking a link scrolls to that review. |
| T2 | Ask something the reviews don't cover, e.g. "Is there parking?" | Says the reviews don't mention it. No invented facts. |
| T3 | Switch to Español and ask a question | Answer comes back in Spanish. |
| T4 | Open a program with no published reviews | The ask box doesn't appear. |
| T5 | Ask "Am I eligible for Post-9/11 benefits?" | No eligibility advice; points to VA.gov / the school's certifying official. |
| T6 | Submit an empty or 1-character question | Button stays disabled / friendly error. |
| T7 | Program with 1–2 reviews | Answer shows the "small number of reviews" label. |
| T8 | Check `/api/health` | Still `ok: true`; deployment has ≤ 12 functions. |
