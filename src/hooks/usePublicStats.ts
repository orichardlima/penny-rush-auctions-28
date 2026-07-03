import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Estatísticas públicas comprovadas para exibição no Hero.
 * Fonte de verdade: banco. Sem números hardcoded, sem promessas financeiras,
 * sem satisfação/NPS até haver pesquisa real.
 * Se a query falhar, retorna null e o componente esconde o card.
 */
export const usePublicStats = () => {
  const [availableAuctions, setAvailableAuctions] = useState<number | null>(null);
  const [finishedAuctions, setFinishedAuctions] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ count: available }, { count: finished }] = await Promise.all([
          supabase
            .from('auctions')
            .select('id', { count: 'exact', head: true })
            .in('status', ['active', 'waiting']),
          supabase
            .from('auctions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'finished'),
        ]);
        if (!alive) return;
        setAvailableAuctions(typeof available === 'number' ? available : null);
        setFinishedAuctions(typeof finished === 'number' ? finished : null);
      } catch (e) {
        console.error('[usePublicStats] erro:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { availableAuctions, finishedAuctions, loading };
};
