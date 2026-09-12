-- Atomic balance arithmetic.
--
-- The worker and the webhook both did read-then-write on
-- profiles.credits_balance. The distributor spawns every pending job in one
-- poll, so workers run concurrently: on 2026-09-12 two jobs finished 11 ms
-- apart, both read the same balance, both wrote it back, and one deduction was
-- lost — the ledger said 25 while the balance said 32.
--
-- Doing the arithmetic inside a single UPDATE makes the row lock serialise the
-- two writers, so no update can clobber another.
CREATE OR REPLACE FUNCTION public.apply_credit_delta(p_user_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
BEGIN
  UPDATE public.profiles
     SET credits_balance = GREATEST(0, credits_balance + p_delta)
   WHERE id = p_user_id
  RETURNING credits_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'no profile for user %', p_user_id;
  END IF;

  RETURN new_balance;
END;
$$;

-- Server-side callers only: this function can mint credits, so no end user may
-- ever invoke it directly.
REVOKE ALL ON FUNCTION public.apply_credit_delta(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_credit_delta(uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.apply_credit_delta(uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_credit_delta(uuid, numeric) TO service_role;
