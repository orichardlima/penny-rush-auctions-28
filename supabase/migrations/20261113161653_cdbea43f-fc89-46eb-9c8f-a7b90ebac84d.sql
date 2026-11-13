DROP TRIGGER IF EXISTS trg_profile_insert_completeness ON public.profiles;
CREATE TRIGGER trg_zz_profile_insert_completeness BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_insert_completeness();
UPDATE public.profiles p SET profile_complete = true
WHERE p.document_type = 'CNPJ' AND coalesce(p.profile_complete,false) = false
  AND coalesce(p.is_blocked,false) = false AND public._profile_data_complete(p);