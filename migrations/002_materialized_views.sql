-- ═══════════════════════════════════════════════════════════════════════════
-- DMD-097 Migration 002 — Materialized views for cohort analytics
-- Run AFTER migration 001.
--
-- Views created (in dependency order):
--   1. cohort_users             — one row per user with cohort metadata
--   2. weekly_user_activity     — one row per (user_id, activity_week)
--   3. cohort_retention_matrix  — pre-computed (cohort_week, weeks_since_signup)
--   4. cohort_revenue           — MRR / ARPU / LTV per cohort
--
-- Refresh order (enforced by cron):
--   1 → 2 → 3 → 4 (3 and 4 depend on 1 and 2)
--
-- CONCURRENT refresh requires a unique index on each view.
-- Refresh is nightly at 2am UTC via /api/cron/refresh-views.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── View 1: cohort_users ────────────────────────────────────────────────────
-- One row per user. Snapshot of their cohort week, plan, activation status.
-- Source: profiles table.

DROP MATERIALIZED VIEW IF EXISTS public.cohort_users CASCADE;

CREATE MATERIALIZED VIEW public.cohort_users AS
SELECT
  p.id                                       AS user_id,
  p.cohort_week,
  p.plan,
  p.activated_at,
  p.last_active_at,
  p.source,
  p.created_at,
  CASE WHEN p.activated_at IS NOT NULL THEN true ELSE false END AS is_activated,
  -- Days from signup to activation (null if not yet activated)
  CASE
    WHEN p.activated_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (p.activated_at - p.created_at)) / 3600
    ELSE NULL
  END                                        AS hours_to_activation
FROM public.profiles p
WHERE p.cohort_week IS NOT NULL;

-- Unique index required for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS cohort_users_user_id_idx
  ON public.cohort_users (user_id);

-- Query pattern indexes
CREATE INDEX IF NOT EXISTS cohort_users_cohort_week_idx
  ON public.cohort_users (cohort_week);

CREATE INDEX IF NOT EXISTS cohort_users_plan_idx
  ON public.cohort_users (plan);


-- ─── View 2: weekly_user_activity ────────────────────────────────────────────
-- One row per (user_id, activity_week).
-- "Activity" = any event fired; activity_week = Monday of that week.
-- Source: analytics_events table.

DROP MATERIALIZED VIEW IF EXISTS public.weekly_user_activity CASCADE;

CREATE MATERIALIZED VIEW public.weekly_user_activity AS
SELECT
  e.user_id,
  date_trunc('week', e.occurred_at)::date              AS activity_week,
  COUNT(*)                                              AS event_count,
  COUNT(*) FILTER (WHERE e.event_name = 'post_generated')  AS posts_generated,
  COUNT(*) FILTER (WHERE e.event_name = 'post_copied')     AS posts_copied,
  COUNT(*) FILTER (WHERE e.event_name = 'video_transcript_fetched') AS videos_fetched,
  MIN(e.occurred_at)                                    AS first_event_at,
  MAX(e.occurred_at)                                    AS last_event_at
FROM public.analytics_events e
WHERE e.user_id IS NOT NULL
GROUP BY e.user_id, date_trunc('week', e.occurred_at);

-- Unique index for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS wua_user_week_idx
  ON public.weekly_user_activity (user_id, activity_week);

-- Common query patterns
CREATE INDEX IF NOT EXISTS wua_activity_week_idx
  ON public.weekly_user_activity (activity_week DESC);

CREATE INDEX IF NOT EXISTS wua_user_idx
  ON public.weekly_user_activity (user_id);


-- ─── View 3: cohort_retention_matrix ─────────────────────────────────────────
-- One row per (cohort_week, weeks_since_signup).
-- Retention = % of cohort that had ≥1 event in that week bucket.
-- Depends on: cohort_users, weekly_user_activity.
--
-- This is the source for:
--   - The retention heatmap (x=week#, y=cohort, color=retention%)
--   - Cohort comparison curves (line per cohort, x=week#, y=retention%)

DROP MATERIALIZED VIEW IF EXISTS public.cohort_retention_matrix CASCADE;

CREATE MATERIALIZED VIEW public.cohort_retention_matrix AS
WITH cohort_sizes AS (
  SELECT
    cohort_week,
    COUNT(DISTINCT user_id) AS cohort_size
  FROM public.cohort_users
  GROUP BY cohort_week
),
cohort_activity AS (
  SELECT
    cu.cohort_week,
    -- Week 0 = same week as signup, Week 1 = 7-13 days after signup, etc.
    GREATEST(0,
      ((wua.activity_week - cu.cohort_week) / 7)::int
    )                                               AS weeks_since_signup,
    COUNT(DISTINCT wua.user_id)                     AS retained_users
  FROM public.cohort_users cu
  JOIN public.weekly_user_activity wua
    ON cu.user_id = wua.user_id
    AND wua.activity_week >= cu.cohort_week
  GROUP BY cu.cohort_week, weeks_since_signup
)
SELECT
  ca.cohort_week,
  ca.weeks_since_signup,
  cs.cohort_size,
  ca.retained_users,
  ROUND(
    ca.retained_users::numeric / NULLIF(cs.cohort_size, 0) * 100,
    1
  )                                                 AS retention_pct
FROM cohort_activity ca
JOIN cohort_sizes cs ON ca.cohort_week = cs.cohort_week
-- Cap at week 52 to prevent runaway growth
WHERE ca.weeks_since_signup <= 52
ORDER BY ca.cohort_week, ca.weeks_since_signup;

-- Unique index for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS crm_cohort_week_idx
  ON public.cohort_retention_matrix (cohort_week, weeks_since_signup);

CREATE INDEX IF NOT EXISTS crm_weeks_since_idx
  ON public.cohort_retention_matrix (weeks_since_signup);


-- ─── View 4: cohort_revenue ───────────────────────────────────────────────────
-- Revenue and LTV per (cohort_week, plan).
-- Source: cohort_users (plan is Stripe-synced on profiles).
--
-- LTV model: ARPU / churn_rate
-- Currently uses a static 5% monthly churn estimate — this WILL be replaced
-- with data-driven churn once we have 6+ months of subscription data.
-- Watch cohort_delta('ltv', ...) to see if real LTV tracks the estimate.

DROP MATERIALIZED VIEW IF EXISTS public.cohort_revenue CASCADE;

CREATE MATERIALIZED VIEW public.cohort_revenue AS
SELECT
  cu.cohort_week,
  cu.plan,
  COUNT(DISTINCT cu.user_id)                          AS cohort_size,
  COUNT(DISTINCT cu.user_id) FILTER (WHERE cu.plan != 'free')  AS paid_users,
  -- Monthly revenue contribution from current plan mix
  ROUND(SUM(
    CASE cu.plan
      WHEN 'starter'   THEN 9.99
      WHEN 'unlimited' THEN 19.99
      ELSE 0
    END
  )::numeric, 2)                                      AS mrr_contribution,
  -- ARPU across the whole cohort (including free)
  ROUND(
    SUM(CASE cu.plan
      WHEN 'starter'   THEN 9.99
      WHEN 'unlimited' THEN 19.99
      ELSE 0
    END) / NULLIF(COUNT(DISTINCT cu.user_id), 0)
  , 2)                                                AS arpu,
  -- ARPU per paying user (for LTV denominator)
  ROUND(
    SUM(CASE cu.plan
      WHEN 'starter'   THEN 9.99
      WHEN 'unlimited' THEN 19.99
      ELSE 0
    END) / NULLIF(COUNT(DISTINCT cu.user_id) FILTER (WHERE cu.plan != 'free'), 0)
  , 2)                                                AS arpu_paid,
  -- Estimated LTV = ARPU_paid / assumed 5% monthly churn
  -- Replace 0.05 with actual_churn_rate once calculated from data
  ROUND(
    (SUM(CASE cu.plan
      WHEN 'starter'   THEN 9.99
      WHEN 'unlimited' THEN 19.99
      ELSE 0
    END) / NULLIF(COUNT(DISTINCT cu.user_id) FILTER (WHERE cu.plan != 'free'), 0))
    / 0.05
  , 2)                                                AS estimated_ltv
FROM public.cohort_users cu
GROUP BY cu.cohort_week, cu.plan;

-- Unique index for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS cr_cohort_plan_idx
  ON public.cohort_revenue (cohort_week, plan);

CREATE INDEX IF NOT EXISTS cr_cohort_week_idx
  ON public.cohort_revenue (cohort_week DESC);


-- ─── Refresh function (called by cron) ───────────────────────────────────────
-- Refreshes all 4 views in dependency order.
-- CONCURRENT keeps the view queryable during refresh (no table lock).

CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  start_time timestamptz := clock_timestamp();
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.cohort_users;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_user_activity;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.cohort_retention_matrix;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.cohort_revenue;

  RAISE NOTICE 'Analytics views refreshed in %ms',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time);
END;
$$;

-- Grant execution to service role
-- (Supabase service role bypasses RLS but needs explicit EXECUTE on functions)
GRANT EXECUTE ON FUNCTION public.refresh_analytics_views() TO service_role;
