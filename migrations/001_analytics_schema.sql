-- ═══════════════════════════════════════════════════════════════════════════
-- DMD-097 Migration 001 — Core analytics schema
-- Run once against your Supabase project via the SQL editor or supabase CLI.
--
-- What this creates:
--   1. public.profiles        — extends auth.users (plan, cohort metadata)
--   2. public.analytics_events — append-only event log (source of truth)
--   3. Indexes on analytics_events for query performance
--   4. Trigger: auto-create profile row on auth.users insert
--   5. RLS policies
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles ────────────────────────────────────────────────────────────
-- One row per user. Extends auth.users via foreign key.
-- IMPORTANT: if you already have a profiles table, replace CREATE TABLE with
-- ALTER TABLE and add only the missing columns.

CREATE TABLE IF NOT EXISTS public.profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- Plan state (Stripe-synced)
  plan             text NOT NULL DEFAULT 'free'  CHECK (plan IN ('free', 'starter', 'unlimited')),
  stripe_customer_id text,
  stripe_subscription_id text,

  -- Cohort fields
  cohort_week      date,          -- date_trunc('week', created_at) — set by trigger below
  activated_at     timestamptz,   -- set when user fires first post_generated event
  last_active_at   timestamptz,   -- updated on any meaningful event

  -- Attribution
  source           text,          -- 'organic' | utm_source value
  referrer         text           -- document.referrer at signup (no PII)
);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.handle_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profiles_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, cohort_week)
  VALUES (
    NEW.id,
    date_trunc('week', NEW.created_at)::date
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── 2. analytics_events ────────────────────────────────────────────────────
-- Append-only. Never UPDATE or DELETE rows.
-- Partitioning note: when table exceeds ~10M rows, partition by month.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name     text        NOT NULL,
  user_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id     text,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  event_data     jsonb       NOT NULL DEFAULT '{}',
  app_version    text,
  prompt_version text,
  platform       text        NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'extension'))
);

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────
-- Time-range scans (most queries filter by date range first)
CREATE INDEX IF NOT EXISTS idx_events_occurred_at
  ON public.analytics_events (occurred_at DESC);

-- User event history
CREATE INDEX IF NOT EXISTS idx_events_user_occurred
  ON public.analytics_events (user_id, occurred_at DESC);

-- Event name filtering (funnel queries)
CREATE INDEX IF NOT EXISTS idx_events_name_occurred
  ON public.analytics_events (event_name, occurred_at DESC);

-- JSONB event_data — GIN for containment queries
-- e.g. WHERE event_data @> '{"post_type": "initial"}'
CREATE INDEX IF NOT EXISTS idx_events_data_gin
  ON public.analytics_events USING gin (event_data);

-- Session grouping
CREATE INDEX IF NOT EXISTS idx_events_session
  ON public.analytics_events (session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL;

-- profiles: cohort_week queries
CREATE INDEX IF NOT EXISTS idx_profiles_cohort_week
  ON public.profiles (cohort_week);

-- profiles: plan filtering
CREATE INDEX IF NOT EXISTS idx_profiles_plan
  ON public.profiles (plan);


-- ─── 4. RLS policies ─────────────────────────────────────────────────────────

-- analytics_events: users can only see their own events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON public.analytics_events FOR SELECT
  USING (auth.uid() = user_id);

-- Service role bypasses RLS — all server-side writes use service role key

-- profiles: users can read/update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
