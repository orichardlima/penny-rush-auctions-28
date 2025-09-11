import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealTimeProtection = () => {
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
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

    // Chamar sistema de proteção a cada 1 segundo
    intervalRef.current = setInterval(callProtectionSystem, 1000);
    console.log('🚀 [REAL-TIME-PROTECTION] Sistema iniciado (1s)');

    // Chamada inicial
    callProtectionSystem();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('🛑 [REAL-TIME-PROTECTION] Sistema parado');
      }
    };
  }, []);
};