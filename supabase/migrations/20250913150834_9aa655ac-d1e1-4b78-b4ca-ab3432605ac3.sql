-- Criar função is_admin_user que está sendo usada em várias RLS policies
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND is_admin = true
  );
$function$