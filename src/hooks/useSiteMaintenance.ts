import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SiteMaintenanceStatus {
  enabled: boolean;
  message: string;
}

export const DEFAULT_MAINTENANCE_MESSAGE = 'Estamos em manutenção para melhorar sua experiência. Voltamos em breve!';

/**
 * Status de manutenção do site, legível por qualquer visitante (RPC pública).
 * Reatualiza a cada 60s para que a manutenção entre em vigor em todo o site.
 */
export const useSiteMaintenance = () => {
  const { user } = useAuth();

  const query = useQuery<SiteMaintenanceStatus>({
    queryKey: ['site-maintenance-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_site_maintenance_status');
      if (error) throw error;
      const raw = data as { enabled?: boolean; message?: string } | null;
      return {
        enabled: !!raw?.enabled,
        message: raw?.message || DEFAULT_MAINTENANCE_MESSAGE,
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  // Só consultamos o papel de admin quando a manutenção está ativa.
  const adminQuery = useQuery<boolean>({
    queryKey: ['site-maintenance-admin', user?.id ?? null],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc('is_admin_user', { user_uuid: user.id });
      if (error) return false;
      return !!data;
    },
    enabled: !!user && !!query.data?.enabled,
    staleTime: 5 * 60_000,
  });

  const status = query.data ?? { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
  // Falha ao carregar = site aberto (fail-open), para nunca travar o acesso por erro técnico.
  const isLocked = !!query.data?.enabled && !!query.isSuccess && !adminQuery.data && !adminQuery.isLoading;

  return {
    status,
    loading: query.isLoading,
    isError: query.isError,
    isAdmin: !!adminQuery.data,
    isAdminLoading: adminQuery.isLoading,
    isLocked,
  };
};
