-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004. Profile billing guardrails
--
-- Prevent authenticated browser clients from changing billing/subscription
-- fields on public.profiles. Stripe webhooks and server-side service-role
-- code remain able to update these columns.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

UPDATE public.profiles
SET plan_limit = 150
WHERE plan = 'unlimited' AND plan_limit IS NULL;

CREATE OR REPLACE FUNCTION public.prevent_client_billing_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF
    NEW.plan IS DISTINCT FROM OLD.plan OR
    NEW.plan_limit IS DISTINCT FROM OLD.plan_limit OR
    NEW.plan_renews_at IS DISTINCT FROM OLD.plan_renews_at OR
    NEW.plan_status IS DISTINCT FROM OLD.plan_status OR
    NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
    NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
  THEN
    RAISE EXCEPTION 'billing_profile_fields_are_server_managed' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_client_billing_profile_changes ON public.profiles;
CREATE TRIGGER prevent_client_billing_profile_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_billing_profile_changes();

COMMENT ON FUNCTION public.prevent_client_billing_profile_changes() IS
  'Blocks non-service-role updates to plan, Stripe, and subscription fields.';
