import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseBackendTimerProps {
  auctionId: string;
}

export const useBackendTimer = ({ auctionId }: UseBackendTimerProps) => {
  const [localTimeLeft, setLocalTimeLeft] = useState<number>(0);
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [auctionStatus, setAuctionStatus] = useState<string>('active');
  const [lastBidAt, setLastBidAt] = useState<string | null>(null);
  
  // Estados para dados do leilão sincronizados com o timer
  const [auctionData, setAuctionData] = useState({
    currentPrice: 0,
    totalBids: 0,
    recentBidders: [] as string[],
    winnerName: null as string | null
  });
  
  const localTimerRef = useRef<NodeJS.Timeout>();
  const bidCheckIntervalRef = useRef<NodeJS.Timeout>();
  const lastVerifyingStart = useRef<number>();
  
  // Usar refs para evitar recriações desnecessárias do checkForNewBids
  const lastBidCountRef = useRef(lastBidCount);
  const lastBidAtRef = useRef(lastBidAt);
  const auctionStatusRef = useRef(auctionStatus);
  const isVerifyingRef = useRef(isVerifying);
  const localTimeLeftRef = useRef(localTimeLeft);
  
  // Atualizar refs quando valores mudarem
  useEffect(() => {
    lastBidCountRef.current = lastBidCount;
  }, [lastBidCount]);
  
  useEffect(() => {
    lastBidAtRef.current = lastBidAt;
  }, [lastBidAt]);
  
  useEffect(() => {
    auctionStatusRef.current = auctionStatus;
  }, [auctionStatus]);
  
  useEffect(() => {
    isVerifyingRef.current = isVerifying;
  }, [isVerifying]);
  
  useEffect(() => {
    localTimeLeftRef.current = localTimeLeft;
  }, [localTimeLeft]);

  // Limpar timers
  const clearTimers = useCallback(() => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = undefined;
    }
    if (bidCheckIntervalRef.current) {
      clearInterval(bidCheckIntervalRef.current);
      bidCheckIntervalRef.current = undefined;
    }
  }, []);

  // Iniciar timer local autônomo que decrementa a cada 1 segundo
  const startLocalTimer = useCallback((initialTime: number) => {
    console.log(`🚀 [${auctionId}] Iniciando timer autônomo: ${initialTime}s`);
    
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    setLocalTimeLeft(initialTime);
    setIsVerifying(false);

    localTimerRef.current = setInterval(() => {
      setLocalTimeLeft(prev => {
        const newTime = Math.max(0, prev - 1);
        console.log(`⏰ [${auctionId}] Timer: ${prev}s → ${newTime}s`);
        
        if (newTime === 0) {
          console.log(`🔚 [${auctionId}] Timer chegou a 0 - Verificando lances válidos`);
          setIsVerifying(true);
          lastVerifyingStart.current = Date.now();
        }
        
        return newTime;
      });
    }, 1000);
  }, [auctionId]);

  // Buscar dados completos do leilão
  const fetchCompleteAuctionData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('last_bid_at, total_bids, status, time_left, current_price, winner_name')
        .eq('id', auctionId)
        .single();

      if (error || !data) return data;

      // Buscar lances recentes para nomes dos últimos lances
      const { data: bids } = await supabase
        .from('bids')
        .select('user_id, created_at')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(5);

      let recentBidderNames: string[] = [];
      if (bids && bids.length > 0) {
        const userIds = bids.map(bid => bid.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const userNameMap = new Map();
        profiles?.forEach(profile => {
          userNameMap.set(profile.user_id, profile.full_name || 'Usuário');
        });

        recentBidderNames = bids.map(bid => 
          userNameMap.get(bid.user_id) || 'Usuário'
        );
      }

      const updatedData = {
        currentPrice: data.current_price || 0,
        totalBids: data.total_bids || 0,
        recentBidders: recentBidderNames,
        winnerName: data.winner_name
      };

      setAuctionData(updatedData);
      return data;
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao buscar dados completos:`, error);
      return null;
    }
  }, [auctionId]);

  // Verificar novos lances - versão otimizada com refs estáveis
  const checkForNewBids = useCallback(async () => {
    if (!auctionId || auctionStatusRef.current !== 'active') return;

    try {
      // Query simples para verificar apenas as informações essenciais
      const { data, error } = await supabase
        .from('auctions')
        .select('id, total_bids, last_bid_at, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) {
        console.error(`❌ [${auctionId}] Erro na verificação de lances:`, error);
        return;
      }

      // Se leilão foi finalizado, parar todos os timers
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado`);
        setAuctionStatus('finished');
        setIsVerifying(false);
        clearTimers();
        return;
      }

      // Se está verificando há muito tempo, forçar refresh do status
      if (isVerifyingRef.current && localTimeLeftRef.current === 0) {
        const timeSinceVerifying = Date.now() - (lastVerifyingStart.current || Date.now());
        if (timeSinceVerifying > 5000) { // 5 segundos
          console.log(`⏰ [${auctionId}] Timeout na verificação, forçando refresh...`);
          setIsVerifying(false);
          startLocalTimer(15); // Resetar timer
        }
      }

      const currentBidCount = data.total_bids || 0;
      const newLastBidAt = data.last_bid_at;

      // Detectar novo lance usando refs para evitar recriações
      if (currentBidCount > lastBidCountRef.current || (newLastBidAt && newLastBidAt !== lastBidAtRef.current)) {
        console.log(`🎯 [${auctionId}] Novo lance detectado! Atualizando dados completos...`);
        
        // Atualizar estados e refs
        setLastBidAt(newLastBidAt);
        setLastBidCount(currentBidCount);
        lastBidAtRef.current = newLastBidAt;
        lastBidCountRef.current = currentBidCount;
        
        // Só buscar dados completos quando detectar novo lance
        try {
          await fetchCompleteAuctionData();
        } catch (fetchError) {
          console.error(`❌ [${auctionId}] Erro ao buscar dados completos:`, fetchError);
        }
        
        // Resetar timer para 15 segundos
        console.log(`🆕 [${auctionId}] NOVO LANCE! Resetando timer para 15s`);
        startLocalTimer(15);
      }

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao verificar novos lances:`, error);
    }
  }, [auctionId, startLocalTimer, clearTimers, fetchCompleteAuctionData]);

  // Inicialização do sistema - sem dependência circular
  const initialize = useCallback(async () => {
    try {
      console.log(`🔄 [${auctionId}] Inicializando sistema de timer...`);
      
      const { data, error } = await supabase
        .from('auctions')
        .select('time_left, last_bid_at, total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) {
        console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
        return;
      }

      // Definir estado inicial
      setLastBidAt(data.last_bid_at);
      setLastBidCount(data.total_bids);
      setAuctionStatus(data.status);
      
      // Atualizar refs também
      lastBidAtRef.current = data.last_bid_at;
      lastBidCountRef.current = data.total_bids;
      auctionStatusRef.current = data.status;

      // Buscar dados completos iniciais
      await fetchCompleteAuctionData();

      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão já finalizado`);
        setIsVerifying(false);
        return;
      }

      // Iniciar timer local com time_left do backend
      const initialTime = data.time_left || 15;
      console.log(`⚡ [${auctionId}] Iniciando com ${initialTime}s do backend`);
      startLocalTimer(initialTime);

      // Iniciar verificação de novos lances a cada 500ms (direto, sem dependência)
      if (bidCheckIntervalRef.current) {
        clearInterval(bidCheckIntervalRef.current);
      }
      bidCheckIntervalRef.current = setInterval(() => {
        checkForNewBids();
      }, 500);
      console.log(`👀 [${auctionId}] Verificação de lances iniciada (500ms)`);

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
    }
  }, [auctionId, startLocalTimer, fetchCompleteAuctionData, checkForNewBids]);

  // Integração com Page Visibility API para forçar sync após inatividade
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized) {
        console.log(`👀 [${auctionId}] Usuário voltou à aba, forçando sincronização completa...`);
        fetchCompleteAuctionData();
        checkForNewBids();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [auctionId, isInitialized, checkForNewBids]);

  // Effect de inicialização
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      await initialize();
      if (isMounted) {
        setIsInitialized(true);
      }
    };

    init();

    return () => {
      isMounted = false;
      clearTimers();
    };
  }, [auctionId, initialize, clearTimers]);

  console.log(`📊 [${auctionId}] Estado: timer=${localTimeLeft}s | verificando=${isVerifying} | status=${auctionStatus}`);

  return {
    backendTimeLeft: localTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus,
    // Retornar dados sincronizados do leilão
    currentPrice: auctionData.currentPrice,
    totalBids: auctionData.totalBids,
    recentBidders: auctionData.recentBidders,
    winnerName: auctionData.winnerName
  };
};