-- M2 — Stripe credits system
--
-- Deviations from the m2-stripe-credits skill template, forced by this project's
-- actual M1 schema (see the skill's "Project conventions to match" block):
--   * public.profiles already exists from M1 with columns
--     (id, display_name, avatar_url, usage_minutes, monthly_quota_minutes,
--      created_at, updated_at) and has NO `role` and NO `email` column, so
--     handle_new_user must not reference them.
--   * M1's handle_new_user populates display_name; this migration MERGES the
--     credits behaviour into it instead of replacing it, or new signups would
--     stop getting a display_name.
--   * jobs.status CHECK in this project is
--     ('pending','downloading','transcribe','done','failed')
--     — note `transcribe` (not `transcribing`) and `failed` (not `error`).
--     The re-added constraint keeps all five and adds 'insufficient_credits'.
--   * Policies are wrapped in guarded DO blocks so the migration is re-runnable.

-- 0. profiles (no-op here: M1 already created it)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. credits_balance on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_balance numeric NOT NULL DEFAULT 30;

-- Backfill: existing users get the 30-credit signup bonus retroactively
UPDATE public.profiles SET credits_balance = 30 WHERE credits_balance = 0;

-- 2. Ledger table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'deduction', 'signup_bonus', 'admin_grant')),
  description text,
  job_id uuid REFERENCES public.jobs(id),
  stripe_payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id
  ON public.credit_transactions(user_id, created_at DESC);

-- Idempotency: at most one purchase row per payment_intent
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_tx_payment_intent
  ON public.credit_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Products catalog
CREATE TABLE IF NOT EXISTS public.credit_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits numeric NOT NULL,
  price_usd numeric NOT NULL,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view active products" ON public.credit_products
    FOR SELECT TO authenticated USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Real sandbox price IDs from acct_1UEu83FRSaH3ifFU ("JKMC 沙盒"), created 2026-09-12
INSERT INTO public.credit_products (name, credits, price_usd, stripe_price_id)
SELECT v.name, v.credits, v.price_usd, v.stripe_price_id
FROM (VALUES
  ('10 Credits', 10::numeric, 10.00::numeric, 'price_1UEujRFRSaH3ifFUCDIijKMB'),
  ('45 Credits', 45::numeric, 30.00::numeric, 'price_1UEujWFRSaH3ifFUmvQr9cgz'),
  ('90 Credits', 90::numeric, 60.00::numeric, 'price_1UEujbFRSaH3ifFUu3lv42uN')
) AS v(name, credits, price_usd, stripe_price_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.credit_products p WHERE p.stripe_price_id = v.stripe_price_id
);

-- 4. Signup trigger: 30-credit welcome bonus, merged with M1's display_name logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, credits_balance)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      30
    )
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (NEW.id, 30, 'signup_bonus', 'Welcome bonus — 30 free credits');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. New job status: insufficient_credits (keeps this project's five M1 values)
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending', 'downloading', 'transcribe', 'done', 'failed', 'insufficient_credits'));

-- 6. Backfill signup_bonus for users created before this migration
INSERT INTO public.credit_transactions (user_id, amount, type, description)
SELECT u.id, 30, 'signup_bonus', 'Welcome bonus — 30 free credits (backfilled)'
FROM auth.users u
LEFT JOIN public.credit_transactions ct
  ON ct.user_id = u.id AND ct.type = 'signup_bonus'
WHERE ct.id IS NULL;
