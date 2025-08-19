-- Corrigir última função que está faltando search_path

CREATE OR REPLACE FUNCTION public.lock_finished_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status = 'finished' AND NEW.status IS DISTINCT FROM 'finished' THEN
    RAISE EXCEPTION 'Finished auctions cannot be reactivated';
  END IF;

  IF OLD.status = 'finished' AND (
    NEW.ends_at IS DISTINCT FROM OLD.ends_at OR
    NEW.time_left IS DISTINCT FROM OLD.time_left
  ) THEN
    RAISE EXCEPTION 'Finished auctions cannot change timer';
  END IF;

  RETURN NEW;
END;
$function$;