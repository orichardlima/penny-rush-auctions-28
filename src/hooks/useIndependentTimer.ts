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

  // Verificar novos lances - versão otimizada (apenas query simples)
  const checkForNewBids = useCallback(async () => {
    if (!auctionId || auctionStatus !== 'active') return;

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
      if (isVerifying && localTimeLeft === 0) {
        const timeSinceVerifying = Date.now() - (lastVerifyingStart.current || Date.now());
        if (timeSinceVerifying > 5000) { // 5 segundos
          console.log(`⏰ [${auctionId}] Timeout na verificação, forçando refresh...`);
          setIsVerifying(false);
          startLocalTimer(15); // Resetar timer
        }
      }

      const currentBidCount = data.total_bids || 0;
      const newLastBidAt = data.last_bid_at;

      // Detectar novo lance
      if (currentBidCount > lastBidCount || (newLastBidAt && newLastBidAt !== lastBidAt)) {
        console.log(`🎯 [${auctionId}] Novo lance detectado! Atualizando dados completos...`);
        setLastBidAt(newLastBidAt);
        setLastBidCount(currentBidCount);
        
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
  }, [auctionId, auctionStatus, lastBidCount, lastBidAt, isVerifying, localTimeLeft, startLocalTimer, clearTimers, fetchCompleteAuctionData]);

  // Inicialização do sistema
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

      // Iniciar verificação de novos lances a cada 500ms (tempo real)
      bidCheckIntervalRef.current = setInterval(checkForNewBids, 500);
      console.log(`👀 [${auctionId}] Verificação de lances iniciada (500ms)`);

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
    }
  }, [auctionId, startLocalTimer, checkForNewBids, fetchCompleteAuctionData]);

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