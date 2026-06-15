# Drafture launch instructions

Target: public launch with paid plans live, Monday April 27, 2026.
Project root: `C:\Users\rdsol\OneDrive\Documents\Claude\Projects\Drafture`.
Panel: 14 seats at `00_Panel/`. Three hard-veto seats (Academic Integrity Officer, Trust and Safety / Counsel, Privacy and Data Protection Officer) sign off on launch.

This file is the launch playbook. Work top to bottom. Each section ends with a verifiable check.

---

## 0. What changed in this build

If you skipped the conversation, here is what's new since the codebase moved out of `draft-my-degree`:

- Folder moved to `Projects/Drafture/`. Package renamed `drafture`. `node_modules` and `.next` deliberately not copied. Run `npm install` once.
- 14-seat Devil's Advocate panel added at `00_Panel/`.
- Auth wired end to end. Real signup, login, logout, email-confirmation callback. `middleware.ts` enforces session on `/dashboard/**` and bounces logged-in users off `/login` and `/signup`.
- Stripe wired end to end. Checkout creation, webhook handler, customer portal. Plan changes from Stripe sync into `profiles.plan` + `profiles.plan_limit` automatically.
- Server-side plan + monthly usage enforcement on `/api/generate`. Atomic check-and-increment via Postgres RPC. Free 3, Starter 30, Finals 150.
- New migration `003_subscriptions_and_usage.sql` adds `usage_counters`, `spend_ledger`, `generations`, the `increment_usage_if_under_limit` RPC, and extra `profiles` columns (`plan_limit`, `plan_renews_at`, `plan_status`).
- Legal pages added. `/privacy`, `/terms`, `/acceptable-use`. Footer rewritten to link them.
- Marketing repositioned. The hero, features, and meta description no longer claim to "pass detection" or "evade detectors". The product is now positioned as a writing coach that produces a first draft in the student's voice. Three panel seats hold hard veto on this framing.
- `/robots.ts`, `/sitemap.ts`, `/not-found.tsx`, `/error.tsx` added.
- `.env.example` added. CLAUDE.md replaced with a full project rules file.
- `@supabase/ssr` added to dependencies. Run `npm install` to fetch it.
- Shared writing architecture added at `src/lib/writing-engine.ts`. Generated posts and notes now use one primary writer, one safety/humanization pass, and one validator instead of separate raw one-pass outputs.

---

## 1. One-time install

```bash
cd "C:\Users\rdsol\OneDrive\Documents\Claude\Projects\Drafture"
npm install
```

Verify:
```bash
npm run typecheck
npm run lint
```
Both should exit clean. If they don't, fix the failures before continuing. The Lead Engineer seat will not approve a launch with a broken type-check.

---

## 2. Supabase setup

You need a Supabase project. If you don't have one, create it at https://supabase.com.

### 2.1 Run migrations in order

In Supabase SQL editor, paste and run each file in this exact order:

1. `migrations/001_analytics_schema.sql`
2. `migrations/002_materialized_views.sql`
3. `migrations/003_subscriptions_and_usage.sql`
4. `migrations/004_profile_billing_guardrails.sql`

Verification queries to paste into the SQL editor after migration 3:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('plan_limit', 'plan_renews_at', 'plan_status');
-- expect 3 rows

SELECT pg_get_functiondef('public.increment_usage_if_under_limit(uuid,text)'::regprocedure) IS NOT NULL;
-- expect t
```

### 2.2 Auth settings

In Supabase dashboard, Authentication > URL Configuration:
- Site URL: `https://app.getdrafture.com` (or whatever your production domain is)
- Redirect URLs: add `https://app.getdrafture.com/api/auth/callback` and `http://localhost:3000/api/auth/callback`

In Authentication > Providers:
- Email: enabled. Confirm email: ON for production.

### 2.3 Grab keys

Settings > API. Copy:
- Project URL > `NEXT_PUBLIC_SUPABASE_URL`
- anon (public) key > `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role (secret) key > `SUPABASE_SERVICE_ROLE_KEY`

---

## 3. Stripe setup

### 3.1 Create products and prices

In Stripe Dashboard > Products, create two recurring monthly products:

| Product   | Price   | Notes                                  |
|-----------|---------|----------------------------------------|
| Starter   | $9.99   | Recurring monthly. 30 drafts/month.    |
| Finals    | $19.99  | Recurring monthly. 150 drafts/month fair use. |

Copy each price ID (starts with `price_`) into env:
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_UNLIMITED` (the internal env name still backs the Finals plan)

### 3.2 Webhook endpoint

Stripe Dashboard > Developers > Webhooks > Add endpoint:

- URL: `https://app.getdrafture.com/api/stripe/webhook`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the signing secret (`whsec_...`) into env as `STRIPE_WEBHOOK_SECRET`.

### 3.3 Local webhook testing

Install the Stripe CLI then:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET` in `.env.local` while developing.

### 3.4 Spend safeguard

In Stripe Dashboard > Settings > Tax: choose your registration. For US-only launch, Tax can stay off for now.

---

## 4. Anthropic setup

Get a key from https://console.anthropic.com.

Set a daily spend cap on the key. Open the console > Settings > Spend > add a limit. The Lead Engineer seat recommends $200/day for the first week. The in-app `DAILY_SPEND_CEILING_USD` is a soft kill-switch; the Anthropic console cap is the hard backstop.

Copy the key to `ANTHROPIC_API_KEY`.

---

## 5. Upstash and PostHog (rate limit and analytics)

### Upstash

https://console.upstash.com > Create database > pick the closest region. Copy the REST URL and REST Token to:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without these set, rate limiting is disabled. The Trust and Safety seat blocks launch on this. Set them.

### PostHog

https://posthog.com > Project settings > API key. Copy to:
- `POSTHOG_API_KEY` and `POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`

PostHog is optional. Without it, analytics still go to the Supabase `analytics_events` table (source of truth).

---

## 6. Environment variables

Copy `.env.example` to `.env.local` and fill in every value that is not marked OPTIONAL. Mirror them in Vercel project settings under Environment Variables. The full list, briefly:

| Var                                  | Required for launch | Source                     |
|--------------------------------------|---------------------|----------------------------|
| NEXT_PUBLIC_APP_URL                  | yes                 | your domain                |
| NEXT_PUBLIC_SUPABASE_URL             | yes                 | Supabase                   |
| NEXT_PUBLIC_SUPABASE_ANON_KEY        | yes                 | Supabase                   |
| SUPABASE_SERVICE_ROLE_KEY            | yes                 | Supabase                   |
| ANTHROPIC_API_KEY                    | yes                 | Anthropic console          |
| STRIPE_SECRET_KEY                    | yes                 | Stripe                     |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   | yes                 | Stripe                     |
| STRIPE_WEBHOOK_SECRET                | yes                 | Stripe webhook             |
| STRIPE_PRICE_STARTER                 | yes                 | Stripe products            |
| STRIPE_PRICE_UNLIMITED               | yes                 | Stripe products            |
| TAVILY_API_KEY                       | recommended         | tavily.com                 |
| DAILY_SPEND_CEILING_USD              | yes                 | set to 200 for week 1      |
| UPSTASH_REDIS_REST_URL               | yes                 | Upstash                    |
| UPSTASH_REDIS_REST_TOKEN             | yes                 | Upstash                    |
| POSTHOG_API_KEY                      | optional            | PostHog                    |
| ADMIN_SECRET                         | yes                 | `openssl rand -hex 32`     |
| CRON_SECRET                          | yes                 | `openssl rand -hex 32`     |

---

## 7. Local end-to-end test

Before deploying, run this exact sequence locally:

```bash
npm run dev
```

In a separate terminal:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Then in a browser:

1. Visit `http://localhost:3000` and confirm the new copy renders ("first draft in your voice", footer has Acceptable Use / Privacy / Terms).
2. Click "Start for free", create an account. Confirm email if prompted.
3. Land on `/dashboard`. Generate one draft. Confirm it works and shows month count.
4. Go to `/pricing`, click Get Starter or Go Finals. Use Stripe test card `4242 4242 4242 4242`, any future date, any CVC, any ZIP.
5. After redirect, refresh dashboard. Confirm the plan badge updates and `profiles.plan_limit` in Supabase changes from 3 to 30 or null.
6. Generate up to the limit. Confirm the 31st request on Starter returns 402 with the upgrade message.
7. Open Stripe customer portal via `/api/stripe/portal` (POST), cancel the subscription. Wait for the webhook. Confirm `profiles.plan` flips back to `free`.

If any step above fails, do not deploy.

---

## 8. Deploy to Vercel

```bash
# from project root
git init && git add . && git commit -m "Drafture launch build"
# push to a new GitHub repo
```

In Vercel:

1. Import the GitHub repo.
2. Build settings: framework Next.js, root `.`, no overrides.
3. Add every env var from section 6 to Production AND Preview.
4. Deploy.
5. Set custom domain `app.getdrafture.com` (or your domain). Confirm SSL.
6. Update Stripe webhook URL and Supabase Auth redirect URLs to the production domain.
7. Re-run section 7 against the production URL using Stripe live keys. Test card stops working in live mode; you can test with a real card and a $0.50 product if you must, then refund yourself.

---

## 9. Pre-launch panel sign-off

Run the panel before announcing. From `00_Panel/invocations.md`:

> "Convene the full panel for launch sign-off. Each hard-veto seat reports green / yellow / red, with one sentence of rationale. The Skeptic delivers a pre-mortem. The Dean closes."

Three veto seats must hit green:

- **Academic Integrity Officer** confirms no copy claims to "pass detection" or to be "undetectable".
- **Trust and Safety / Counsel** confirms terms, acceptable use, and privacy all render at their public URLs and are linked from the footer; Stripe live keys are connected; webhook signature verification is on.
- **Privacy and Data Protection Officer** confirms Supabase RLS is enabled on `analytics_events`, `usage_counters`, and `generations`; the privacy page lists all subprocessors; and a deletion path is documented.

If any of those is yellow or red, do not launch. Fix and re-convene.

---

## 10. Day-of and first 72 hours

### Day of launch

- Pin a tab on the Anthropic console > Spend dashboard. Watch hourly for the first day.
- Pin a tab on Supabase > Auth > Users to watch signups roll in.
- Pin a tab on Stripe > Payments to watch first paid conversions.
- Set a calendar event for 24 hours after launch to revisit the spend cap.

### First 72 hours

- Customer Support seat covers the inbox. Response target 4 hours during waking hours. Refund anyone who asks; arguing is a waste of trust this week.
- AI Quality Lead samples 20 random generations from `public.generations` and rates each one. Anything below an 8/10 in the Self-Eval column is a candidate for a prompt fix in week 2.
- Pricing seat watches conversion rate from Free to paid. If it's under 3% by day 7, the panel reconvenes on pricing.
- Lead Engineer monitors error rate. Anything above 0.5% on `/api/generate` is a P1.

### Killswitch

If costs spike or abuse surfaces:

```sql
-- Lock signups instantly
UPDATE auth.config SET disable_signup = true;
```

To pause generation entirely without taking the site down, set `DAILY_SPEND_CEILING_USD=0` in Vercel and redeploy. Every request will return 503 with the spend-cap message.

---

## 11. Things that are NOT done and need to ship in week 1

These didn't block launch but the panel flagged them as week-1 priorities:

1. **Resend integration** for transactional email beyond Supabase auth: receipt confirmations, soft-paywall reminders, monthly summary.
2. **Dashboard upgrade button** that calls `/api/stripe/checkout` from inside the app instead of forcing a re-signup detour. Not strictly required (the marketing site path works) but reduces friction.
3. **Customer portal link** in the dashboard sidebar that POSTs to `/api/stripe/portal` and follows the URL. Without this, users have to email support to cancel.
4. **Sentry** for client-side error tracking. Currently `error.tsx` logs only to console.
5. **`/api/account/delete` endpoint** to satisfy GDPR / CCPA Right to Erasure in code instead of via email request. Privacy seat will demand this within 30 days.
6. **Email verification UX polish**. Right now Supabase sends a default email. Customize the template.
7. **Spend ledger** swap. Replace the in-memory `spend-guard.ts` with calls to the new `record_spend` and `get_daily_spend` RPCs. The schema is in place; the code swap is roughly 10 lines.

These are tracked as week-1 follow-ups, not launch blockers. The panel signed off knowing they exist.

---

## 12. Reference

- Project rules: `CLAUDE.md`
- Panel: `00_Panel/`
- Schema: `migrations/`
- Generation engine: `src/app/api/generate/route.ts` and `src/lib/humanization/`
- Shared writing engine: `src/lib/writing-engine.ts`
- Auth: `src/lib/supabase-server.ts`, `src/lib/auth.ts`, `middleware.ts`
- Billing: `src/lib/stripe.ts`, `src/app/api/stripe/`
- Plan enforcement: `src/lib/plan.ts`

When in doubt, summon the relevant panel seat. The shortcuts are in `00_Panel/invocations.md`.

end of instructions.
