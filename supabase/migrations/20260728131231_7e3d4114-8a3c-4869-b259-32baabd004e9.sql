
-- 1) Trigger de defesa em profundidade em public.bids
CREATE OR REPLACE FUNCTION public.bids_block_bot_points_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_bot boolean := false;
  v_is_test boolean := false;
  v_is_admin boolean := false;
BEGIN
  SELECT COALESCE(is_bot,false), COALESCE(is_test_account,false), COALESCE(is_admin,false)
    INTO v_is_bot, v_is_test, v_is_admin
    FROM public.profiles
   WHERE user_id = NEW.user_id;

  IF v_is_bot OR v_is_test OR v_is_admin THEN
    NEW.eligible_for_points := false;
    NEW.points_rule_id := NULL;
    NEW.points_campaign_id := NULL;
    NEW.points_multiplier_snapshot := NULL;
    NEW.lot_id := NULL;
    NEW.source := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bids_block_bot_points_eligibility ON public.bids;
CREATE TRIGGER trg_bids_block_bot_points_eligibility
BEFORE INSERT OR UPDATE ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.bids_block_bot_points_eligibility();

COMMENT ON FUNCTION public.bids_block_bot_points_eligibility() IS
'Bloqueia elegibilidade a Pontos Show para lances de bots, contas de teste e admins. Defesa em profundidade — não substitui filtros no settle.';

-- 2) Backfill defensivo
UPDATE public.bids b
   SET eligible_for_points = false,
       points_rule_id = NULL,
       points_campaign_id = NULL,
       points_multiplier_snapshot = NULL
  FROM public.profiles p
 WHERE p.user_id = b.user_id
   AND (COALESCE(p.is_bot,false) OR COALESCE(p.is_test_account,false) OR COALESCE(p.is_admin,false))
   AND b.eligible_for_points = true;
