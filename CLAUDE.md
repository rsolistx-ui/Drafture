# Drafture project rules for Claude

## Hard rules

1. **No em dashes.** Anywhere. Code comments, copy, commit messages, file names. Use a period, comma, colon, parentheses, or rephrase.
2. **No "AI detection bypass" framing.** The product is a writing coach that produces a first draft in the student's voice. Never write copy that says "undetectable", "pass detection", "evade AI detectors", "bypass Turnitin", or similar. This is a hard veto on the panel and a Stripe AUP / Anthropic AUP risk.
3. **Server-side auth only for /api/generate.** Never trust a client-supplied user_id. The route extracts the user from the Supabase cookie via `getCurrentProfile()`.
4. **Never log raw prompts or raw drafts at production log level.** Generation logs include token counts and costs. Output content goes only to the `generations` table tied to the user.
5. **All user-facing writing must go through `src/lib/writing-engine.ts`.** Use the primary writer plus safety/humanization pass and validator. Do not add direct one-pass prose endpoints.

## Panel

The 14-seat Devil's Advocate panel for Drafture lives at `00_Panel/`. Three seats hold hard veto:

- Academic Integrity Officer
- Trust and Safety / Counsel
- Privacy and Data Protection Officer

For any launch decision, copy change, or feature touching academic context, run it past the relevant seat. Quick invocations are in `00_Panel/invocations.md`.

## Architecture quick map

- `src/app/page.tsx`. Landing page.
- `src/app/(auth)/login` and `signup`. Client auth pages that submit to `/api/auth/*`.
- `src/app/api/auth/*`. Supabase signup, login, logout, email-confirmation callback.
- `src/app/api/stripe/*`. Checkout, webhook, customer portal.
- `src/app/api/generate/route.ts`. The four-pass generation pipeline. Auth, plan, and spend gates run before any Anthropic call.
- `src/lib/writing-engine.ts`. Shared primary-plus-safety writing architecture used by generated posts and notes.
- `src/lib/humanization/prompts.ts`. Core IP. The system prompts for the draft and humanizer passes. Touch carefully.
- `src/lib/humanization/forbidden-patterns.ts`. Vocabulary database. Do not expand without an AI Quality Lead review.
- `src/lib/plan.ts`. Atomic check-and-increment of the monthly counter. Calls the Postgres RPC `increment_usage_if_under_limit`.
- `src/lib/spend-guard.ts`. Daily Anthropic spend ceiling. In-memory in dev. Swap to `record_spend` RPC in prod.
- `middleware.ts`. Refreshes Supabase session, gates `/dashboard/**`.
- `migrations/`. Three SQL files. Run in order via Supabase SQL editor.

## Working in this codebase

- `npm run dev` to run locally.
- `npm run typecheck` before committing.
- `npm run lint` to surface unused imports and rule violations.
- Stripe test mode for any local billing work. Use the Stripe CLI to forward webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- Never check `.env.local` into git. The example template is `.env.example`.
- New migrations follow the pattern `00X_description.sql`. Idempotent (use `IF NOT EXISTS` and `OR REPLACE`).

## Voice

Blunt, witty, late-night-finals energy. Speaks to a stressed student at 11:47 PM. Never corporate. Never preachy. The full voice profile lives at `00_Panel/voice_profile.md`. The AI-tells library at `00_Panel/ai_tells_library.md` is the list of phrases never to ship.

@AGENTS.md
