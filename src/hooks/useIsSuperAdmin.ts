import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Verifica se o usuário logado é o super-admin definido em
 * system_settings.super_admin_user_id. Apenas ele pode impersonar parceiros.
 */
export const useIsSuperAdmin = () => {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) { setIsSuperAdmin(false); setLoading(false); return; }
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'super_admin_user_id')
        .maybeSingle();
      if (!cancelled) {
        setIsSuperAdmin(data?.setting_value === user.id);
        setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user]);

  return { isSuperAdmin, loading };
};
