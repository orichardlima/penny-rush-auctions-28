-- Modificar função para permitir admin reativar leilões finalizados
CREATE OR REPLACE FUNCTION public.lock_finished_auctions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Verificar se está tentando reativar um leilão finalizado
  IF OLD.status = 'finished' AND NEW.status IS DISTINCT FROM 'finished' THEN
    -- Permitir apenas se for admin
    IF NOT is_admin_user(auth.uid()) THEN
      RAISE EXCEPTION 'Apenas administradores podem reativar leilões finalizados';
    END IF;
    
    -- Log da reativação para auditoria
    RAISE LOG '[REATIVAÇÃO] Leilão % reativado por admin %', NEW.id, auth.uid();
  END IF;

  -- Bloquear alterações de timer em leilões finalizados (exceto reativação)
  IF OLD.status = 'finished' AND NEW.status = 'finished' AND (
    NEW.ends_at IS DISTINCT FROM OLD.ends_at OR
    NEW.time_left IS DISTINCT FROM OLD.time_left
  ) THEN
    RAISE EXCEPTION 'Finished auctions cannot change timer';
  END IF;

  RETURN NEW;
END;
$function$