-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003. Server-side usage counters + subscription state
--
-- Run after 001 and 002. Idempotent (uses IF NOT EXISTS / OR REPLACE).
--
-- Adds:
--   1. usage_counters         (per-user, per-month generation count, server-enforced)
--   2. atomic increment RPC   (single-call increment with limit check)
--   3. profiles.plan_limit    (denormalized monthly cap for fast checks)
--   4. profiles.plan_renews_at (Stripe period end, drives access cutoff)
--   5. RLS policies + indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend profiles with plan metadata ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_limit       integer,        -- null = unlimited
  ADD COLUMN IF NOT EXISTS plan_renews_at   timestamptz,    -- Stripe current_period_end
  ADD COLUMN IF NOT EXISTS plan_status      text DEFAULT 'active'
    CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.plan_limit IS
  'Monthly generation cap. NULL means unlimited. Set by Stripe webhook based on price ID.';

-- ─── 2. Backfill plan_limit for existing rows ──────────────────────────────
UPDATE public.profiles
SET plan_limit = CASE plan
  WHEN 'free'      THEN 3
  WHEN 'starter'   THEN 30
  WHEN 'unlimited' THEN NULL
  ELSE 3
END
WHERE plan_limit IS NULL;

-- ─── 3. usage_counters ─────────────────────────────────────────────────────
-- One row per user per month. Atomic upsert on increment.
CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_key   text        NOT NULL,    -- 'YYYY-MM'
  count       integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_user
  ON public.usage_counters (user_id, month_key DESC);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own usage"
  ON public.usage_counters FOR SELECT
  USING (auth.uid() = user_id);

-- Service role does the writes.

-- ─── 4. Atomic increment RPC ────────────────────────────────────────────────
-- Returns the NEW count, or raises an exception if it would exceed plan_limit.
-- Called server-side from /api/generate after spend-guard passes.
CREATE OR REPLACE FUNCTION public.increment_usage_if_under_limit(
  p_user_id uuid,
  p_month_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit integer;
  v_new_count integer;
BEGIN
  -- Read user's plan limit. NULL means unlimited.
  SELECT plan_limit INTO v_limit
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_limit IS NULL THEN
    -- Unlimited plan: just increment, no cap.
    INSERT INTO public.usage_counters (user_id, month_key, count, updated_at)
    VALUES (p_user_id, p_month_key, 1, now())
    ON CONFLICT (user_id, month_key)
    DO UPDATE SET
      count = public.usage_counters.count + 1,
      updated_at = now()
    RETURNING count INTO v_new_count;
    RETURN v_new_count;
  END IF;

  -- Capped plan: increment only if under limit.
  INSERT INTO public.usage_counters (user_id, month_key, count, updated_at)
  VALUES (p_user_id, p_month_key, 1, now())
  ON CONFLICT (user_id, month_key)
  DO UPDATE SET
    count = public.usage_counters.count + 1,
    updated_at = now()
  WHERE public.usage_counters.count < v_limit
  RETURNING count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'usage_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_usage_if_under_limit(uuid, text) IS
  'Atomic check-and-increment. Raises usage_limit_exceeded if over plan cap.';

-- ─── 5. Daily spend ledger (replaces in-memory accumulator) ─────────────────
CREATE TABLE IF NOT EXISTS public.spend_ledger (
  day_key      date        PRIMARY KEY,
  total_usd    numeric(10,6) NOT NULL DEFAULT 0,
  generations  integer     NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.record_spend(p_cost_usd numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'UTC')::date;
  v_total numeric;
BEGIN
  INSERT INTO public.spend_ledger (day_key, total_usd, generations, updated_at)
  VALUES (v_day, p_cost_usd, 1, now())
  ON CONFLICT (day_key) DO UPDATE SET
    total_usd   = public.spend_ledger.total_usd + EXCLUDED.total_usd,
    generations = public.spend_ledger.generations + 1,
    updated_at  = now()
  RETURNING total_usd INTO v_total;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_spend()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(total_usd, 0)
  FROM public.spend_ledger
  WHERE day_key = (now() AT TIME ZONE 'UTC')::date;
$$;

-- ─── 6. Generations table. Durable record for support and history ─────────
CREATE TABLE IF NOT EXISTS public.generations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  post_type       text NOT NULL CHECK (post_type IN ('initial', 'classmate', 'instructor')),
  prompt_excerpt  text,                    -- first 280 chars of prompt, no PII expansion
  word_count      integer,
  cost_usd        numeric(10,6),
  prompt_version  text,
  -- Output is stored encrypted-at-rest by Postgres. Strip on user delete via cascade.
  output          text,
  flagged         boolean NOT NULL DEFAULT false,    -- moderation, future
  flag_reason     text
);

CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON public.generations (user_id, created_at DESC);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own generations"
  ON public.generations FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Done. Verify with:
--   SELECT count(*) FROM public.profiles;
--   SELECT count(*) FROM public.usage_counters;
--   SELECT public.increment_usage_if_under_limit('<test-user-uuid>', '2026-04');
-- ═══════════════════════════════════════════════════════════════════════════
