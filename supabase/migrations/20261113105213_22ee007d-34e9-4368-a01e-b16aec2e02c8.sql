CREATE OR REPLACE FUNCTION public._profiles_lock_document_type()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.document_type IS DISTINCT FROM OLD.document_type OR NEW.company_name IS DISTINCT FROM OLD.company_name)
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND COALESCE(p.is_admin,false)) THEN
    NEW.document_type := OLD.document_type; NEW.company_name := OLD.company_name;
  END IF;
  RETURN NEW;
END $function$;