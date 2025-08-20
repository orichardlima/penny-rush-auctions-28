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

  // Sincroniza offset de tempo com o servidor brasileiro
  useEffect(() => {
    let cancelled = false;

    const fetchServerTime = async () => {
      try {
        const { data, error } = await supabase.rpc('current_server_time');
        if (!error && data && !cancelled) {
          // Servidor agora retorna horário brasileiro
          const serverMs = new Date(data as string).getTime();
          const clientBrazilMs = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
          const clientBrazilDate = new Date(clientBrazilMs);
          serverOffsetRef.current = serverMs - clientBrazilDate.getTime();
          console.log('[TIME] Offset servidor brasileiro (ms):', serverOffsetRef.current);
        }
      } catch (err) {
        console.warn('⚠️ [TIME] Falha ao obter hora do servidor brasileiro', err);
      }
    };

    fetchServerTime();
    const interval = setInterval(fetchServerTime, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Estado para aguardar finalização pelo cron job
  const [isWaitingFinalization, setIsWaitingFinalization] = useState(false);
  const [finalizationMessage, setFinalizationMessage] = useState('');
  const finalizationTimeoutRef = useRef<NodeJS.Timeout>();

  // Mensagens rotativas para aguardar finalização
  const finalizationMessages = [
    'Aguarde um momento',
    'Finalizando leilão',
    'Conferindo lances validos',
    'Conferindo vencedor'
  ];

  // Controla as mensagens rotativas quando aguardando finalização
  useEffect(() => {
    if (!isWaitingFinalization) {
      // Limpar timeout de proteção quando sair do estado de finalização
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
        finalizationTimeoutRef.current = undefined;
      }
      return;
    }

    let messageIndex = 0;
    setFinalizationMessage(finalizationMessages[0]);

    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % finalizationMessages.length;
      setFinalizationMessage(finalizationMessages[messageIndex]);
    }, 1000);

    // Timeout de proteção reduzido para 10 segundos
    finalizationTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ [FINALIZATION] Timeout de proteção ativado - saindo do estado de finalização');
      setIsWaitingFinalization(false);
    }, 10000);

    return () => {
      clearInterval(messageInterval);
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
        finalizationTimeoutRef.current = undefined;
      }
    };
  }, [isWaitingFinalization]);

  // Função chamada quando timer chega a zero - com verificação de segurança inteligente
  const checkAuctionStatusAndReset = useCallback(async () => {
    if (!auctionId || checkingStatusRef.current || !isActiveRef.current) return;
    
    checkingStatusRef.current = true;
    console.log('⚡ [ZERO] Timer chegou a zero - verificando se deve mostrar finalização');
    
    try {
      // VERIFICAÇÃO DE SEGURANÇA: Só mostrar finalização se realmente deve encerrar
      const { data, error } = await supabase
        .from('auctions')
        .select('status, time_left, updated_at')
        .eq('id', auctionId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        console.log('🔍 [ZERO] Status verificado:', data);
        
        // Calcular segundos desde última atividade (usando fuso brasileiro)
        const lastActivityMs = new Date(data.updated_at).getTime();
        const brazilNowMs = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
        const nowMs = new Date(brazilNowMs).getTime();
        const secondsSinceActivity = Math.floor((nowMs - lastActivityMs) / 1000);
        
        console.log('📊 [ZERO] Segundos desde última atividade:', secondsSinceActivity);
        
        // Atualizar dados do leilão
        setAuctionData(prev => prev ? { 
          ...prev, 
          status: data.status,
          time_left: data.time_left
        } : null);
        setLocalTimeLeft(data.time_left);
        
        // LÓGICA INTELIGENTE DE FINALIZAÇÃO:
        if (data.status === 'finished') {
          // Leilão já foi encerrado pelo cron job
          setIsWaitingFinalization(false);
          console.log('✅ [ZERO] Leilão já finalizado - não mostrar mensagens');
        } else if (data.time_left > 0) {
          // Novo lance chegou, resetar timer
          console.log('🔄 [ZERO] Timer resetado para', data.time_left, 's - não mostrar mensagens');
        } else if (secondsSinceActivity >= 15 && data.status === 'active') {
          // Realmente deve mostrar finalização (15+ segundos sem atividade)
          setIsWaitingFinalization(true);
          console.log('⏳ [ZERO] Mostrando finalização - 15+ segundos sem atividade');
          
          // Polling agressivo para verificar mudanças a cada 2 segundos
          const pollingInterval = setInterval(async () => {
            try {
              const { data: pollData } = await supabase
                .from('auctions')
                .select('status, time_left')
                .eq('id', auctionId)
                .maybeSingle();
              
              if (pollData) {
                console.log('🔄 [POLLING] Status durante finalização:', pollData);
                if (pollData.status === 'finished' || pollData.time_left > 0) {
                  setIsWaitingFinalization(false);
                  clearInterval(pollingInterval);
                  console.log('✅ [POLLING] Saindo da finalização:', pollData);
                }
              }
            } catch (err) {
              console.error('❌ [POLLING] Erro:', err);
            }
          }, 2000);
          
          // Limpar polling após 10 segundos
          setTimeout(() => {
            clearInterval(pollingInterval);
          }, 10000);
          
        } else {
          // Menos de 15 segundos - não mostrar finalização ainda
          console.log('⏰ [ZERO] Apenas', secondsSinceActivity, 's de inatividade - aguardando mais atividade');
          
          // Polling a cada 1 segundo por 10 segundos para verificar se timer reseta
          let pollCount = 0;
          const quickPolling = setInterval(async () => {
            pollCount++;
            if (pollCount > 10) {
              clearInterval(quickPolling);
              return;
            }
            
            try {
              const { data: quickData } = await supabase
                .from('auctions')
                .select('time_left, status')
                .eq('id', auctionId)
                .maybeSingle();
              
              if (quickData && quickData.time_left > 0) {
                console.log('🔄 [QUICK] Timer resetado para', quickData.time_left, 's');
                setLocalTimeLeft(quickData.time_left);
                clearInterval(quickPolling);
              }
            } catch (err) {
              console.error('❌ [QUICK] Erro:', err);
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ [ZERO] Erro ao verificar status:', error);
    } finally {
      checkingStatusRef.current = false;
    }
  }, [auctionId]);

  // Timer local baseado no ends_at do servidor - PRIORIDADE ABSOLUTA
  useEffect(() => {
    if (!isActiveRef.current) return;

    // Se não tem ends_at ou não está ativo, limpar timer
    if (!auctionData?.ends_at || auctionData.status !== 'active') {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
      // Se status é finished, definir timer como 0
      if (auctionData?.status === 'finished') {
        setLocalTimeLeft(0);
      } else {
        setLocalTimeLeft(null);
      }
      return;
    }

    // NOVA LÓGICA: Sempre reinicializar timer quando ends_at muda (indica reset por bot)
    const calculateTimeLeft = () => {
      if (!isActiveRef.current) return 0;
      const endMs = new Date(auctionData.ends_at!).getTime();
      const brazilNowMs = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
      const nowMs = new Date(brazilNowMs).getTime() + (serverOffsetRef.current || 0);
      return Math.max(0, Math.round((endMs - nowMs) / 1000));
    };

    const tick = () => {
      if (!isActiveRef.current) return;
      const remaining = calculateTimeLeft();
      setLocalTimeLeft(remaining);
      
      // Quando contador chega a 0, verificar status do leilão
      if (remaining === 0 && auctionData.status === 'active') {
        checkAuctionStatusAndReset();
      }
    };

    // Limpar timer anterior
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    // Inicializar novo timer
    const initialTime = calculateTimeLeft();
    setLocalTimeLeft(initialTime);
    localTimerRef.current = setInterval(tick, 1000);

    console.log(`🎯 [TIMER] Timer reinicializado: ${initialTime}s (ends_at mudou: ${auctionData.ends_at})`);

    return () => {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
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
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) {
        console.log('⚠️ [SYNC] Leilão não encontrado - pode ter sido removido ou encerrado');
        return;
      }
      
      if (isActiveRef.current && data) {
        console.log('🔄 [SYNC] Dados atualizados do banco:', {
          auction_id: data.id,
          time_left: data.time_left,
          status: data.status,
          timestamp: new Date().toISOString()
        });
        
        setAuctionData(data);
        
        // Se o leilão foi finalizado, definir timer como 0
        if (data.status === 'finished') {
          setLocalTimeLeft(0);
        } else {
          // Apenas calcular timer se ainda estiver ativo (usando fuso brasileiro)
          const endsAtMs = data.ends_at ? new Date(data.ends_at).getTime() : null;
          const brazilNowMs = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
          const nowMs = new Date(brazilNowMs).getTime() + (serverOffsetRef.current || 0);
          const initial = endsAtMs ? Math.max(0, Math.round((endsAtMs - nowMs) / 1000)) : (data.time_left || 0);
          setLocalTimeLeft(initial);
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
          const wasWaitingFinalization = isWaitingFinalization;
          
          // SMART SYNC: Só sincronizar se houve mudança significativa
          const currentEndsAt = auctionData?.ends_at;
          const newEndsAt = newAuctionData.ends_at;
          const timerWasReset = newEndsAt !== currentEndsAt;
          
          setAuctionData(newAuctionData);
          
          // Se o leilão foi finalizado, parar timer e sair do estado de finalização
          if (newAuctionData.status === 'finished') {
            setLocalTimeLeft(0);
            setIsWaitingFinalization(false);
            console.log('✅ [FINALIZATION] Leilão finalizado - saindo do estado de finalização');
          } else if (timerWasReset && newAuctionData.status === 'active') {
            // APENAS resetar timer local se ends_at realmente mudou (indica lance de bot)
            console.log(`🎯 [SMART-SYNC] Timer reset detectado: ends_at mudou de ${currentEndsAt} → ${newEndsAt}`);
            
            // Se estava aguardando finalização, sair do estado
            if (wasWaitingFinalization) {
              setIsWaitingFinalization(false);
              console.log('🔄 [FINALIZATION] Timer resetado - saindo do estado de finalização');
            }
          } else {
            // NÃO alterar localTimeLeft se timer não foi resetado (evita oscilação)
            console.log('⚪ [SYNC] Update normal - mantendo timer local para evitar oscilação');
          }
          
          setLastSync(new Date());
          setIsConnected(true);
          
          // Log detalhado para debug
          console.log('🕐 [REALTIME] Timer atualizado via banco:', {
            auction_id: newAuctionData.id,
            time_left: newAuctionData.time_left,
            timer_reset: timerWasReset,
            current_price: newAuctionData.current_price,
            total_bids: newAuctionData.total_bids,
            status: newAuctionData.status,
            was_waiting_finalization: wasWaitingFinalization,
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
      
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
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
  // Remover sincronização manual - deixar o servidor decidir automaticamente

  // PRIORIDADE ABSOLUTA: Timer local sempre tem precedência (elimina oscilação)
  const displayTimeLeft = localTimeLeft !== null ? localTimeLeft : (auctionData?.time_left || 0);

  return {
    auctionData: auctionData ? { ...auctionData, time_left: displayTimeLeft } : null,
    recentBids,
    isConnected,
    lastSync,
    forceSync,
    isWaitingFinalization,
    finalizationMessage
  };
};