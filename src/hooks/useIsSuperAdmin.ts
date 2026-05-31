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
      const { data, error } = await supabase.rpc('is_super_admin', { _user_id: user.id });
      if (!cancelled) {
        if (error) console.warn('[useIsSuperAdmin] RPC error:', error);
        setIsSuperAdmin(!!data);
        setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user]);

  return { isSuperAdmin, loading };
};
