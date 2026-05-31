import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KEY = 'impersonation_log_id';

/**
 * Banner fixo no topo quando o admin entrou via magic link impersonando um parceiro.
 * O admin-impersonate-user redireciona para /dashboard?impersonating=<log_id>,
 * que é persistido em localStorage até o usuário clicar em "Sair desta sessão".
 */
export const ImpersonationBanner: React.FC = () => {
  const { user, signOut } = useAuth();
  const [logId, setLogId] = useState<string | null>(null);

  useEffect(() => {
    // Captura ?impersonating=<id> da URL e persiste
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('impersonating');
    if (fromUrl) {
      localStorage.setItem(KEY, fromUrl);
      params.delete('impersonating');
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
    setLogId(localStorage.getItem(KEY));
  }, []);

  if (!logId || !user) return null;

  const exitImpersonation = async () => {
    try {
      await supabase
        .from('admin_impersonation_log')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', logId);
    } catch (e) {
      console.error('failed to close impersonation log', e);
    }
    localStorage.removeItem(KEY);
    await signOut();
    window.location.href = '/auth';
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-2 shadow-lg">
      <div className="container mx-auto flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            MODO IMPERSONATION ATIVO — você está logado como <b>{user.email}</b>. Todas as ações são auditadas.
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={exitImpersonation} className="shrink-0">
          <LogOut className="h-4 w-4 mr-1" />
          Sair desta sessão
        </Button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
