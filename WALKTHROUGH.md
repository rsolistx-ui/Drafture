# Drafture launch walkthrough (beginner edition)

This is the click-by-click guide. Work top to bottom. Do not skip ahead.
Each phase ends with a "Did it work?" check. Don't move to the next phase until that check passes.

If you get stuck, paste the error or screenshot back to me and tell me which phase you're on.

You'll need about 2 to 3 hours total. Take breaks. Most steps are filling out forms.

---

## Phase 0. Things to install on your computer

You probably have most of this. Skip what you have.

### 0.1 Node.js (required)

Go to https://nodejs.org and download the **LTS** version (the green button). Install it with all defaults.

To check it worked, open Command Prompt or PowerShell and type:
```
node --version
npm --version
```
You should see version numbers, not errors.

### 0.2 Git (required)

Go to https://git-scm.com/download/win and install with all defaults.

Check:
```
git --version
```

### 0.3 Stripe CLI (only needed for local testing, optional otherwise)

Go to https://docs.stripe.com/stripe-cli, scroll to "Install the Stripe CLI" for Windows. Download the zip, extract it somewhere, and add that folder to your PATH (or just use the full path when you run it later).

You can come back to this later. It's optional.

### 0.4 A code editor (recommended)

VS Code at https://code.visualstudio.com if you don't already have one. It makes editing the `.env.local` file much easier.

**Did it work?** Open Command Prompt and run `node --version` and `git --version`. Both should print version numbers.

---

## Phase 1. Get the project running locally (no backend yet)

Goal: see the website come up at http://localhost:3000 with the new copy.

### 1.1 Open a terminal in the project folder

Open Command Prompt or PowerShell. Then:
```
cd "C:\Users\rdsol\OneDrive\Documents\Claude\Projects\Drafture"
```

### 1.2 Install dependencies

```
npm install
```

This will take 2 to 5 minutes. It downloads about 500 MB of packages into `node_modules/`. You'll see a progress bar and probably some yellow warnings. Yellow warnings are fine. Red errors are not.

If it finishes with "added X packages", you're good.

### 1.3 Make a placeholder env file

The site needs an env file just to start. We'll fill it with real values later.

In VS Code or any editor, copy `.env.example` to a new file named `.env.local` in the same folder. Don't change any values yet. The placeholders are fine for the first start.

### 1.4 Start the dev server

Back in your terminal:
```
npm run dev
```

Wait until you see something like:
```
- Local:        http://localhost:3000
- ready in 2.3s
```

### 1.5 Open the site

In your browser, go to http://localhost:3000

**Did it work?**
- You should see the dark purple Drafture landing page.
- The hero should say "Get unstuck in 60 seconds."
- The footer should have three links: Acceptable use, Privacy, Terms.
- Click each footer link. Each page should render.

If anything looks wrong: stop the server (Ctrl+C in the terminal) and paste me the error.

Leave the server running for the next phases.

---

## Phase 2. Supabase (auth + database)

Goal: a real database with all our tables, and an auth system that can sign people up.

### 2.1 Create a Supabase account

Go to https://supabase.com and click "Start your project". Sign up with GitHub or email.

### 2.2 Create a new project

Click "New project" in your dashboard.

- **Name:** Drafture
- **Database password:** click "Generate a password" and copy it somewhere safe (you probably won't need it but save it just in case)
- **Region:** pick the one closest to you (US East if you're east coast, US West for west)
- **Pricing plan:** Free is fine to launch

Click "Create new project". Wait about 2 minutes while it provisions.

### 2.3 Run the four migrations

You're going to paste four SQL files into Supabase one at a time, in order.

In the Supabase dashboard, click the SQL icon in the left sidebar (looks like `>_`). Click "New query".

**Migration 1:**
- Open `migrations/001_analytics_schema.sql` in VS Code
- Select all (Ctrl+A), copy (Ctrl+C)
- Paste into the Supabase SQL editor
- Click "Run" (or press Ctrl+Enter)
- You should see "Success. No rows returned" at the bottom

**Migration 2:**
- Click "New query" again
- Open `migrations/002_materialized_views.sql`
- Same drill: select all, copy, paste, run
- Wait for success

**Migration 3:**
- Click "New query" again
- Open `migrations/003_subscriptions_and_usage.sql`
- Same drill
- Wait for success

**Migration 4:**
- Click "New query" again
- Open `migrations/004_profile_billing_guardrails.sql`
- Same drill
- Wait for success

### 2.4 Verify the migrations worked

In a new SQL query, paste this and run it:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see at least these tables:
- `analytics_events`
- `cohort_retention_matrix` (a view)
- `cohort_revenue` (a view)
- `cohort_users` (a view)
- `generations`
- `profiles`
- `spend_ledger`
- `usage_counters`
- `weekly_user_activity` (a view)

### 2.5 Configure auth URLs

In Supabase, click the Authentication icon in the left sidebar (the person silhouette). Click "URL Configuration" in the submenu.

- **Site URL:** `http://localhost:3000` (we'll change this to your real domain later)
- **Redirect URLs (Additional):** add these two on separate lines:
  - `http://localhost:3000/api/auth/callback`
  - `http://localhost:3000/dashboard`

Click "Save".

### 2.6 Confirm email settings

Still in Authentication, click "Providers". Click "Email" to expand it.

For local testing, you can turn **"Confirm email"** OFF for now. We'll turn it back on for production. Click Save.

### 2.7 Grab your keys

Click the gear icon (Settings) at the bottom of the sidebar. Click "API".

You'll see three things you need to copy:

1. **Project URL** (top, looks like `https://xxxxxxxx.supabase.co`)
2. **anon public** key (long string starting with `eyJ`)
3. **service_role secret** key (also starts with `eyJ`, click "Reveal" to see it)

Open your `.env.local` file in VS Code. Replace these three lines:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
```

Save the file.

### 2.8 Restart the dev server

In the terminal running `npm run dev`, press Ctrl+C to stop it. Then:
```
npm run dev
```

(Next.js loads env vars at startup, so you have to restart after editing .env.local.)

**Did it work?**
- Go to http://localhost:3000/signup
- Enter a real email you can check and any password 8+ characters
- Click "Create free account"
- It should take you to the dashboard (no email verification because you turned that off in step 2.6)

In Supabase, click "Authentication" then "Users". You should see your test user.

In a new SQL query, run:
```sql
SELECT id, plan, plan_limit FROM public.profiles;
```
You should see one row with `plan = free` and `plan_limit = 3`.

If any of that fails, stop and paste me the error.

---

## Phase 3. Anthropic API key (the AI engine)

Goal: get a key so the generation actually works.

### 3.1 Create an Anthropic account

Go to https://console.anthropic.com and sign up.

### 3.2 Add a payment method

Click "Settings" then "Billing". Add a card. Buy at least $5 of credits to start (you can add more later).

### 3.3 Set a spend cap

This is critical so a runaway loop can't drain your account.

In Settings > Billing, look for "Spend limits" or "Usage limits". Set a daily limit of $20 for the first week. You can raise it later.

### 3.4 Create an API key

In Settings > "API Keys" click "Create Key". Name it "Drafture Production".

Copy the key immediately. It only shows once.

In `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Save.

### 3.5 Restart the dev server and test generation

Stop the dev server (Ctrl+C) and start it again (`npm run dev`).

Go to http://localhost:3000/dashboard. Click "Generate" or whatever leads to the generate page. Paste any prompt like "Discuss why pizza is better than salad" and hit generate.

**Did it work?**
- A draft appears in 30 to 60 seconds.
- In Supabase, run `SELECT count(*) FROM public.usage_counters;` and you should see 1 row, count = 1.

If the generation fails, the most likely cause is a typo in the API key. Double-check, save, restart.

---

## Phase 4. Upstash Redis (rate limiting)

Goal: prevent abuse. Without this, a single bad actor can hammer your API and bankrupt you.

### 4.1 Create an Upstash account

Go to https://console.upstash.com and sign up.

### 4.2 Create a Redis database

Click "Create Database".

- **Name:** drafture-prod
- **Type:** Regional
- **Region:** pick the one closest to you (and ideally same region as your Vercel deploy later)
- **TLS:** on (default)
- **Eviction:** off (default)

Click "Create".

### 4.3 Grab the REST URL and token

On the database page, scroll to "REST API" tab. You'll see two values:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Click the eye icon to reveal each, then copy.

In `.env.local`:
```
UPSTASH_REDIS_REST_URL=https://your-region-xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AbC123YourTokenHere
```

Save and restart `npm run dev`.

**Did it work?**
- Go to your dashboard and try to generate 11 drafts in a row really fast.
- The 11th should fail with "Too many requests" because the limit is 10/minute.

(You can verify in Upstash by going to "Data Browser" and seeing keys like `drafture_rl:gen:...`)

---

## Phase 5. Stripe (payments)

Goal: paid plans actually charge real cards.

### 5.1 Create a Stripe account

Go to https://dashboard.stripe.com/register.

Sign up. They'll ask you about your business. Be honest. "Software / SaaS" and your real legal name and address.

### 5.2 Stay in test mode for now

In the top-right of the Stripe dashboard, you'll see a toggle for "Test mode". Make sure it's ON. We'll switch to live mode at the very end.

### 5.3 Create the two products

Click "Products" in the left sidebar, then "Add product".

**Starter:**
- Name: Drafture Starter
- Description: 30 drafts per month
- Pricing model: Standard pricing
- Price: 9.99 USD
- Billing period: Monthly (Recurring)
- Click "Add product"

After creating, click into the product and copy the price ID (starts with `price_`). It's on the right side under "Pricing".

**Finals:**
- Same drill
- Name: Drafture Finals
- Price: 19.99 USD
- Monthly recurring
- Copy the price ID

### 5.4 Get your API keys

Click "Developers" in the left sidebar, then "API keys".

- Copy the **Publishable key** (starts with `pk_test_`)
- Click "Reveal test key" next to **Secret key** and copy it (starts with `sk_test_`)

In `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_STARTER=price_...your-starter-id
STRIPE_PRICE_UNLIMITED=price_...your-unlimited-id
```

### 5.5 Set up the webhook (local testing path)

For local testing, you'll use the Stripe CLI to forward webhooks to your local server.

Open a NEW terminal (don't close the one running `npm run dev`):
```
stripe login
```
Follow the prompts. It opens a browser for you to authorize.

Then:
```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It will print a webhook signing secret like `whsec_abc123...`. Copy it.

In `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

Save. Leave the `stripe listen` terminal running for the rest of testing.

### 5.6 Restart the dev server

In your `npm run dev` terminal: Ctrl+C, then `npm run dev` again.

**Did it work?**

This is the big test.

1. Go to http://localhost:3000/pricing
2. Click "Get Starter"
3. You'll be redirected to your already-logged-in dashboard? Or to signup? If you're logged in from earlier, you should land on a Stripe checkout page.
4. Use the Stripe test card: `4242 4242 4242 4242`. Any future expiry date (like 12/30). Any 3-digit CVC. Any ZIP.
5. Click pay.
6. You should be redirected to `/dashboard?upgrade=success`.
7. In Supabase SQL editor: `SELECT id, plan, plan_limit FROM public.profiles;` and your row should now show `plan = starter`, `plan_limit = 30`.

If the upgrade didn't change the plan, check the `stripe listen` terminal. It should show events like `checkout.session.completed → 200`. If you see errors there, paste them to me.

---

## Phase 6. PostHog (optional, can skip for launch)

If you want product analytics, do this. If not, skip and come back later.

### 6.1 Create a PostHog account

Go to https://posthog.com and sign up.

### 6.2 Create a project

Pick "Cloud (US)" unless you have a reason to pick EU. Name it Drafture.

### 6.3 Grab the API key

In your PostHog project: Settings (gear icon) > Project > "Project API Key". Copy it.

In `.env.local`:
```
POSTHOG_API_KEY=phc_xxxxx
POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Restart dev server. Generate a draft. Within a minute or so, you should see events appear in PostHog under "Activity" or "Events".

---

## Phase 7. End-to-end test before deploying

Before we put anything on the internet, run this checklist locally. Open a fresh browser window in incognito mode (to start clean).

1. http://localhost:3000 loads, hero says "Get unstuck in 60 seconds"
2. Footer links work: Acceptable use, Privacy, Terms
3. Sign up with a fresh email
4. Land on dashboard, see the plan badge somewhere
5. Generate a draft, it works
6. Generate 3 more drafts. The 4th should be blocked with "monthly limit reached" because you're on Free with 3/month
7. Click upgrade or go to /pricing, click Get Starter
8. Use test card 4242 4242 4242 4242
9. After redirect, generate again. Should work now (you have 30/month)
10. In Stripe Dashboard, find your test customer and click "Cancel subscription"
11. Check Supabase profiles table: plan should flip back to `free` within a minute (the webhook fires)

If all of those pass, you're ready to deploy.

If any fail, stop and tell me which one.

---

## Phase 8. Deploy to Vercel

Goal: real public URL, real users can sign up.

### 8.1 Push the code to GitHub

If you haven't yet:

```
cd "C:\Users\rdsol\OneDrive\Documents\Claude\Projects\Drafture"
git init
git add .
git commit -m "Drafture launch build"
```

Go to https://github.com/new and create a new repo:
- Name: drafture
- Private (recommended) or Public, your choice
- Don't add a README, .gitignore, or license (we already have those)
- Click "Create"

GitHub will show you commands. Use the "push existing repository" set:

```
git remote add origin https://github.com/YOUR-USERNAME/drafture.git
git branch -M main
git push -u origin main
```

(It might prompt you to log in to GitHub the first time. Use a personal access token if asked: https://github.com/settings/tokens > Generate new token > classic > scope `repo` > generate > paste it as the password.)

### 8.2 Connect to Vercel

Go to https://vercel.com and sign up with GitHub.

Click "Add New" > "Project". Pick the `drafture` repo.

Settings to confirm:
- Framework Preset: Next.js (auto-detected)
- Root Directory: `.` (default)
- Build Command: leave default
- Output Directory: leave default

DON'T click Deploy yet. First add env vars.

### 8.3 Add ALL env vars to Vercel

Click "Environment Variables". Add every line from your `.env.local` one by one. For each:
- Name: copy from the left side of the `=`
- Value: copy from the right side
- Environment: check Production AND Preview (both)

Specifically, every var below needs to be there:
- NEXT_PUBLIC_APP_URL (set to your Vercel URL or custom domain, see step 8.6)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- STRIPE_SECRET_KEY
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- STRIPE_WEBHOOK_SECRET (we'll update this in step 8.5)
- STRIPE_PRICE_STARTER
- STRIPE_PRICE_UNLIMITED
- DAILY_SPEND_CEILING_USD (set to 200)
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- ADMIN_SECRET (run `openssl rand -hex 32` in terminal, or use any 64-char random string)
- CRON_SECRET (same)
- POSTHOG_API_KEY (if you set up PostHog)
- POSTHOG_HOST (same)
- NEXT_PUBLIC_POSTHOG_KEY (same)
- NEXT_PUBLIC_POSTHOG_HOST (same)

### 8.4 Click Deploy

Wait 2 to 5 minutes. You'll get a URL like `drafture-abc123.vercel.app`.

Visit it. The site should look identical to your local one.

### 8.5 Update the production webhook

Now that the site is live, point Stripe at the real URL.

In Stripe Dashboard (still in test mode), Developers > Webhooks > "Add endpoint".

- Endpoint URL: `https://your-vercel-url.vercel.app/api/stripe/webhook`
- Events to send (click "Select events"):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Click "Add endpoint"

On the new endpoint's page, click "Reveal" next to "Signing secret" and copy it.

In Vercel, go back to your project's Environment Variables. Edit `STRIPE_WEBHOOK_SECRET` and replace its value with this new one. Save.

You need to redeploy for the new env var to take effect: Deployments tab > three-dot menu on the latest deployment > "Redeploy" > confirm.

### 8.6 Update Supabase auth URLs

In Supabase, Authentication > URL Configuration:
- Site URL: `https://your-vercel-url.vercel.app`
- Redirect URLs: add `https://your-vercel-url.vercel.app/api/auth/callback`

Turn email confirmation back ON now (Authentication > Providers > Email > "Confirm email" = on).

### 8.7 (Optional) Custom domain

If you own getdrafture.com:

In Vercel: Project > Settings > Domains > Add. Enter `app.getdrafture.com`.

Vercel shows you DNS records to add at your domain registrar. Usually a CNAME pointing to `cname.vercel-dns.com`. Add it at your registrar (GoDaddy, Cloudflare, Namecheap). Wait 10 minutes for DNS to propagate.

When the domain is live in Vercel, also update:
- `NEXT_PUBLIC_APP_URL` env var in Vercel to `https://app.getdrafture.com`
- Supabase Site URL and Redirect URL
- Stripe webhook URL (or add a second endpoint)

Redeploy in Vercel after env changes.

**Did it work?**
- Visit your production URL in incognito
- Sign up with a fresh email (you should now get a verification email)
- Click the link in the email, it should take you to the dashboard
- Generate a draft, it should work

---

## Phase 9. Switch to Stripe live mode (real money)

Only do this when everything above works in test mode end-to-end.

### 9.1 Activate your Stripe account

In Stripe Dashboard, click "Activate account" (top of the page in test mode). Fill out the business details, bank account for payouts, and tax info. Stripe takes a few minutes to verify.

### 9.2 Create the products in live mode

Toggle "Test mode" OFF in the top-right.

Repeat step 5.3 (create Starter and Finals products) but in live mode this time. Copy the new live price IDs.

### 9.3 Get live API keys

Repeat step 5.4 to get live keys (now they start with `pk_live_` and `sk_live_`).

### 9.4 Create a live webhook

Repeat step 8.5 but in live mode. Get the new live webhook secret.

### 9.5 Update Vercel env vars

In Vercel Environment Variables, replace these with the live values:
- STRIPE_SECRET_KEY (sk_live_...)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_...)
- STRIPE_WEBHOOK_SECRET (new live whsec_...)
- STRIPE_PRICE_STARTER (live price ID)
- STRIPE_PRICE_UNLIMITED (live price ID)

Redeploy.

### 9.6 Final live test

Use a real card. Buy a Starter plan from your production site. Confirm:
- Charge appears in Stripe Dashboard
- Plan changes in Supabase profiles table

Then immediately cancel the subscription in your dashboard or Stripe Dashboard, and Stripe will refund the prorated amount when you go to "Refund" on the payment.

You're live.

---

## Phase 10. First-day monitoring

Pin three browser tabs:

1. **Anthropic console** > Spend dashboard. Watch hourly the first day. If it spikes, kill the kill-switch (set `DAILY_SPEND_CEILING_USD=0` in Vercel and redeploy).
2. **Stripe Dashboard** > Payments. Watch new conversions roll in.
3. **Supabase** > Authentication > Users. Watch signups roll in.

Set a phone alarm for 6 hours after launch to check in.

---

## When something breaks

The most common failures and what they mean:

| Error                                              | Likely cause                                            |
|----------------------------------------------------|---------------------------------------------------------|
| "Module not found: @supabase/ssr"                  | You skipped `npm install` after I added the dep         |
| "Authentication required" on /api/generate         | You're not logged in, or the cookie didn't set          |
| "Daily generation limit reached"                   | Anthropic spend hit your DAILY_SPEND_CEILING_USD        |
| "Too many requests"                                | Upstash rate limit (10/min/user). Wait 60s.             |
| Stripe webhook never fires after checkout          | Webhook URL mismatch, or wrong signing secret           |
| "Invalid signature" in Stripe webhook              | Wrong STRIPE_WEBHOOK_SECRET in env                      |
| Profile.plan didn't change after Stripe checkout   | Webhook didn't fire OR fired with wrong customer ID     |
| Email verification link goes nowhere               | Supabase Site URL or Redirect URL wrong                 |

When you hit one of these, tell me which phase you're on and paste the exact error. Don't try to debug alone.

end of walkthrough.
