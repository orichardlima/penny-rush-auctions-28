import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuctionUpdate {
  id: string;
  current_price: number;
  total_bids: number;
  time_left: number;
  ends_at: string;
  status: string;
  winner_id?: string;
  winner_name?: string;
}

interface BidUpdate {
  id: string;
  auction_id: string;
  user_id: string;
  bid_amount: number;
  created_at: string;
}

export const useAuctionRealtime = (auctionId?: string) => {
  const [auctionData, setAuctionData] = useState<AuctionUpdate | null>(null);
  const [recentBids, setRecentBids] = useState<BidUpdate[]>([]);
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const localTimerRef = useRef<NodeJS.Timeout>();
  const channelsRef = useRef<any[]>([]);
  const isActiveRef = useRef(true);
  const serverOffsetRef = useRef<number>(0);
  const checkingStatusRef = useRef<boolean>(false);

  // Sincroniza offset de tempo com o servidor (corrige relógios do cliente)
  useEffect(() => {
    let cancelled = false;

    const fetchServerTime = async () => {
      try {
        const { data, error } = await supabase.rpc('current_server_time');
        if (!error && data && !cancelled) {
          const serverMs = new Date(data as string).getTime();
          serverOffsetRef.current = serverMs - Date.now();
          console.log('[TIME] Offset servidor(ms):', serverOffsetRef.current);
        }
      } catch (err) {
        console.warn('⚠️ [TIME] Falha ao obter hora do servidor', err);
      }
    };

    fetchServerTime();
    const interval = setInterval(fetchServerTime, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Função para verificar status quando contador chega a zero
  const checkAuctionStatusAndReset = useCallback(async () => {
    if (!auctionId || checkingStatusRef.current || !isActiveRef.current) return;
    
    checkingStatusRef.current = true;
    console.log('🔍 [ZERO] Verificando status do leilão ao chegar a 0 segundos');
    
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('status, ends_at, time_left')
        .eq('id', auctionId)
        .single();
      
      if (error) throw error;
      
      if (data.status === 'finished') {
        console.log('✅ [ZERO] Leilão encerrado - atualizando dados');
        setAuctionData(prev => prev ? { ...prev, status: 'finished', ...data } : null);
        setLocalTimeLeft(0);
      } else if (data.status === 'active') {
        console.log('🔄 [ZERO] Leilão ainda ativo - resetando contador para 15s');
        // Calcular novo ends_at baseado no servidor (15 segundos a partir de agora)
        const nowMs = Date.now() + (serverOffsetRef.current || 0);
        const newEndsAt = new Date(nowMs + 15000).toISOString();
        
        setAuctionData(prev => prev ? { 
          ...prev, 
          ends_at: newEndsAt,
          time_left: 15 
        } : null);
        setLocalTimeLeft(15);
      }
    } catch (error) {
      console.error('❌ [ZERO] Erro ao verificar status:', error);
      // Fallback: tentar novamente em 3 segundos
      setTimeout(() => {
        checkingStatusRef.current = false;
        if (isActiveRef.current) {
          checkAuctionStatusAndReset();
        }
      }, 3000);
      return;
    }
    
    checkingStatusRef.current = false;
  }, [auctionId]);

  // Timer local baseado no ends_at do servidor
  useEffect(() => {
    if (!isActiveRef.current) return;

    // Se não tem ends_at ou não está ativo, limpar timer
    if (!auctionData?.ends_at || auctionData.status !== 'active') {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
      }
      return;
    }

    const tick = () => {
      if (!isActiveRef.current) return;
      const endMs = new Date(auctionData.ends_at!).getTime();
      const nowMs = Date.now() + (serverOffsetRef.current || 0);
      const remaining = Math.max(0, Math.round((endMs - nowMs) / 1000));
      setLocalTimeLeft(remaining);
      
      // Quando contador chega a 0, verificar status do leilão
      if (remaining === 0 && auctionData.status === 'active') {
        checkAuctionStatusAndReset();
      }
    };

    // Executa imediatamente e depois a cada segundo
    tick();
    localTimerRef.current = setInterval(tick, 1000);

    return () => {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
      }
    };
  }, [auctionData?.ends_at, auctionData?.status, checkAuctionStatusAndReset]);


  // Fetch inicial dos dados
  const fetchAuctionData = useCallback(async () => {
    if (!auctionId || !isActiveRef.current) return;
    
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();
      
      if (error) throw error;
      
      if (isActiveRef.current) {
        console.log('🔄 [SYNC] Dados atualizados do banco:', {
          auction_id: data.id,
          time_left: data.time_left,
          status: data.status,
          timestamp: new Date().toISOString()
        });
        
        setAuctionData(data);
        {
          const endsAtMs = data.ends_at ? new Date(data.ends_at).getTime() : null;
          const nowMs = Date.now() + (serverOffsetRef.current || 0);
          const initial = endsAtMs ? Math.max(0, Math.round((endsAtMs - nowMs) / 1000)) : (data.time_left || 0);
          setLocalTimeLeft(initial); // Sincronizar timer local com base no ends_at
        }
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('❌ [SYNC] Erro ao buscar dados:', error);
    }
  }, [auctionId]);

  // Setup realtime
  useEffect(() => {
    if (!auctionId) return;

    isActiveRef.current = true;
    console.log('🔄 Configurando realtime para leilão:', auctionId);
    
    // Fetch inicial
    fetchAuctionData();

    // Canal para updates do leilão
    const auctionChannel = supabase
      .channel(`auction-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`
        },
        (payload) => {
          if (!isActiveRef.current) return;
          
          console.log('📡 [REALTIME] Update do leilão recebido:', payload);
          const newAuctionData = payload.new as AuctionUpdate;
          setAuctionData(newAuctionData);
          {
            const endsAtMs = newAuctionData.ends_at ? new Date(newAuctionData.ends_at).getTime() : null;
            const nowMs = Date.now() + (serverOffsetRef.current || 0);
            const next = endsAtMs ? Math.max(0, Math.round((endsAtMs - nowMs) / 1000)) : (newAuctionData.time_left || 0);
            setLocalTimeLeft(next); // Resetar timer local com base no ends_at
          }
          setLastSync(new Date());
          setIsConnected(true);
          
          // Log detalhado para debug
          console.log('🕐 [REALTIME] Timer atualizado via banco:', {
            auction_id: newAuctionData.id,
            time_left: newAuctionData.time_left,
            local_timer_reset: true,
            current_price: newAuctionData.current_price,
            total_bids: newAuctionData.total_bids,
            status: newAuctionData.status,
            timestamp: new Date().toISOString()
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Status do canal auction:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    // Canal para novos lances
    const bidsChannel = supabase
      .channel(`bids-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${auctionId}`
        },
        (payload) => {
          if (!isActiveRef.current) return;
          
          console.log('🎯 Novo lance recebido:', payload);
          const newBid = payload.new as BidUpdate;
          setRecentBids(prev => [newBid, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    channelsRef.current = [auctionChannel, bidsChannel];

    // Polling de backup a cada 30 segundos
    const pollingInterval = setInterval(() => {
      if (isActiveRef.current && !isConnected) {
        console.log('🔄 [POLLING] Fazendo backup sync');
        fetchAuctionData();
      }
    }, 30000);

    // Cleanup
    return () => {
      isActiveRef.current = false;
      console.log('🔌 Desconectando realtime channels');
      
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
      }
      
      clearInterval(pollingInterval);
      
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      
      setIsConnected(false);
    };
  }, [auctionId, fetchAuctionData]);

  // Função para forçar sincronização
  const forceSync = useCallback(() => {
    console.log('🔄 [FORCE] Sincronização forçada pelo usuário');
    fetchAuctionData();
  }, [fetchAuctionData]);
  useEffect(() => {
    if (!auctionId || !isActiveRef.current) return;
    const remaining = localTimeLeft !== null ? localTimeLeft : (auctionData?.time_left ?? 0);
    if (auctionData?.status === 'active' && remaining <= 2) {
      // Sincroniza timer no servidor e permite finalização quando necessário
      supabase.rpc('sync_auction_timer', { auction_uuid: auctionId });
    }
  }, [auctionId, localTimeLeft, auctionData?.status]);

  // Retornar timer local se disponível, senão usar o do banco
  const displayTimeLeft = localTimeLeft !== null ? localTimeLeft : auctionData?.time_left;

  return {
    auctionData: auctionData ? { ...auctionData, time_left: displayTimeLeft || 0 } : null,
    recentBids,
    isConnected,
    lastSync,
    forceSync
  };
};