
-- Vincular manualmente a usuária Marta Liberato (a8b147c7-452a-46fb-9f0b-1e3cc03ffa6b)
-- ao afiliado Warlley Silva (affiliate_id: a81dbb33-a174-4455-949e-f2d3bd2c588a / código WARLLE927F)
INSERT INTO public.affiliate_referrals (
  affiliate_id,
  referred_user_id,
  click_source,
  converted,
  created_at
) VALUES (
  'a81dbb33-a174-4455-949e-f2d3bd2c588a',
  'a8b147c7-452a-46fb-9f0b-1e3cc03ffa6b',
  'manual_admin_link',
  false,
  now()
);

-- Atualizar contador de referrals do afiliado Warlley
UPDATE public.affiliates
SET total_referrals = total_referrals + 1
WHERE id = 'a81dbb33-a174-4455-949e-f2d3bd2c588a';
