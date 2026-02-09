import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useRealTimeProtection = () => {
  const intervalRef = useRef<NodeJS.Timeout>();
  const { profile } = useAuth();

  useEffect(() => {
    // Apenas executar para administradores
    if (!profile?.is_admin) {
      console.log('🛡️ [PROTECTION-SYSTEM] Ignorado (não é admin)');
      return;
    }

    const callProtectionSystem = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('sync-timers-and-protection', {
          body: { trigger: 'frontend', timestamp: new Date().toISOString() }
        });

        if (error) {
          console.error('⚠️ [REAL-TIME-PROTECTION] Erro:', error);
        } else if (data?.execution_time_ms > 2000) {
          console.warn(`🐌 [REAL-TIME-PROTECTION] Execução lenta: ${data.execution_time_ms}ms`);
        }
      } catch (error) {
        console.error('💥 [REAL-TIME-PROTECTION] Erro crítico:', error);
      }
    };

    // Chamadas a cada 10 segundos (apenas para admins)
    intervalRef.current = setInterval(callProtectionSystem, 10000);
    console.log('🛡️ [PROTECTION-SYSTEM] Sistema iniciado para ADMIN (10s)');

    // Chamada inicial
    callProtectionSystem();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('🛑 [PROTECTION-SYSTEM] Sistema parado');
      }
    };
  }, [profile?.is_admin]);
};