-- Recriar a função ensure_bot_user para usar um perfil existente como bot
CREATE OR REPLACE FUNCTION public.ensure_bot_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  bot_user_id uuid;
BEGIN
  -- Buscar o primeiro perfil existente para usar como bot
  -- Priorizando perfis de admin ou o primeiro perfil disponível
  SELECT user_id INTO bot_user_id
  FROM public.profiles
  WHERE is_admin = true
  LIMIT 1;
  
  -- Se não encontrar admin, usar qualquer perfil
  IF bot_user_id IS NULL THEN
    SELECT user_id INTO bot_user_id
    FROM public.profiles
    LIMIT 1;
  END IF;
  
  -- Se ainda assim não encontrar, criar um erro controlado
  IF bot_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum perfil encontrado para usar como bot';
  END IF;
  
  -- Atualizar o saldo do perfil para garantir que tenha lances suficientes
  UPDATE public.profiles
  SET bids_balance = GREATEST(bids_balance, 999999)
  WHERE user_id = bot_user_id;
  
  RETURN bot_user_id;
END;
$function$