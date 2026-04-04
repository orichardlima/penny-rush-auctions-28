import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useRealTimeProtection = () => {
  const intervalRef = useRef<NodeJS.Timeout>();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const callProtectionSystem = async () => {
      try {
        const { error } = await supabase.functions.invoke('sync-timers-and-protection', {
          body: { trigger: 'frontend', timestamp: new Date().toISOString() }
        });

        if (error) {
          console.error('⚠️ [PROTECTION] Erro:', error.message);
        }
      } catch (error) {
        // Silenciar erros de rede transitórios
      }
    };

    intervalRef.current = setInterval(callProtectionSystem, 10000);
    callProtectionSystem();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user?.id]);
};
