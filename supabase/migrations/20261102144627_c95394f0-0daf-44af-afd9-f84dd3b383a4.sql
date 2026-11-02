ALTER TABLE public.partner_referral_bonuses DISABLE TRIGGER trg_check_fast_start;
INSERT INTO public.partner_referral_bonuses (referrer_contract_id, referred_contract_id, referred_user_id, aporte_value, bonus_percentage, bonus_value, referral_level, status, available_at, is_fast_start_bonus, source_event, created_at)
SELECT v.referrer, '309c6a89-78bd-4aae-8891-8c4520c13dff'::uuid, '8e083e10-f09c-42b4-9e1b-f6541b890792'::uuid, 50000, v.pct, v.val, v.lvl, 'PENDING',
       public.add_business_days('2026-10-29 17:11:23.936911+00'::timestamptz, 7), false,
       'upgrade:48181178-a872-4114-b8f5-3a01ccc7e805', '2026-10-29 17:11:23.936911+00'::timestamptz
FROM (VALUES ('36ea3dd1-e9bf-4f00-8ab0-a81a0a5e4384'::uuid, 16::numeric, 8000::numeric, 1),
             ('c42ad205-3e35-40ff-a292-c888a6a5011b'::uuid, 2::numeric, 1000::numeric, 2)) v(referrer,pct,val,lvl)
WHERE NOT EXISTS (SELECT 1 FROM public.partner_referral_bonuses b WHERE b.referred_contract_id='309c6a89-78bd-4aae-8891-8c4520c13dff' AND b.source_event='upgrade:48181178-a872-4114-b8f5-3a01ccc7e805' AND b.referral_level=v.lvl);
ALTER TABLE public.partner_referral_bonuses ENABLE TRIGGER trg_check_fast_start;

INSERT INTO public.admin_audit_log (admin_user_id, admin_name, action_type, target_type, target_id, description, new_values)
SELECT (SELECT admin_user_id FROM public.admin_audit_log WHERE action_type='UPGRADE_PLAN' AND target_id::text='309c6a89-78bd-4aae-8891-8c4520c13dff' ORDER BY created_at DESC LIMIT 1), 'Sistema (correção)', 'REFERRAL_BONUS_BACKFILL', 'partner_contract', '309c6a89-78bd-4aae-8891-8c4520c13dff',
 'Bônus de upgrade Diamond 2 -> Diamond 3 (29/10) não gerado por trava de duplicidade; lançados N1 R$ 8.000 (Angelo) e N2 R$ 1.000',
 jsonb_build_object('upgrade_id','48181178-a872-4114-b8f5-3a01ccc7e805');