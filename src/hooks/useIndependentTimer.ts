import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseIndependentTimerProps {
  auctionId: string;
  initialTimeLeft?: number;
}

export const useIndependentTimer = ({ auctionId, initialTimeLeft = 15 }: UseIndependentTimerProps) => {
  const [localTimer, setLocalTimer] = useState(initialTimeLeft); // Começar com valor inicial para evitar zero imediato
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isProtectionActive, setIsProtectionActive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const protectionTimeoutRef = useRef<NodeJS.Timeout>();
  const stuckTimerRef = useRef<NodeJS.Timeout>();
  const resetTimeoutRef = useRef<NodeJS.Timeout>();

  // Buscar tempo real do backend usando a nova função
  const fetchRealTimeLeft = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_auction_time_left', { auction_uuid: auctionId });

      if (error) {
        console.error(`❌ [${auctionId}] Erro ao buscar tempo real:`, error);
        return initialTimeLeft; // Fallback para valor inicial
      }

      const realTimeLeft = data || 0;
      console.log(`🕐 [${auctionId}] Tempo real do backend: ${realTimeLeft}s`);
      return realTimeLeft;
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na RPC get_auction_time_left:`, error);
      return initialTimeLeft;
    }
  }, [auctionId, initialTimeLeft]);

  // Função para resetar timer manualmente
  const resetTimer = useCallback(async () => {
    console.log(`🔄 [${auctionId}] Reset manual do timer solicitado`);
    setIsVerifying(true);
    setIsStuck(false);
    
    try {
      // Buscar dados atuais do leilão
      const { data: auction } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();
      
      if (auction) {
        setLastBidCount(auction.total_bids);
        
        if (auction.status === 'active') {
          const realTimeLeft = await fetchRealTimeLeft();
          setLocalTimer(realTimeLeft > 0 ? realTimeLeft : 15);
          console.log(`✅ [${auctionId}] Timer resetado para ${realTimeLeft}s`);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no reset manual:`, error);
      setLocalTimer(15); // Fallback
    } finally {
      setIsProtectionActive(false);
      setIsVerifying(false);
    }
  }, [auctionId, fetchRealTimeLeft]);

  // Polling para detectar novos lances e sincronizar timer
  const checkForNewBids = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // CRÍTICO: Sempre verificar se houve novos lances
      if (data.total_bids > lastBidCount) {
        console.log(`🔄 [${auctionId}] Novo lance detectado! Sincronizando timer (bids: ${lastBidCount} → ${data.total_bids})`);
        const realTimeLeft = await fetchRealTimeLeft();
        setLocalTimer(realTimeLeft > 0 ? realTimeLeft : 15);
        setLastBidCount(data.total_bids);
        setIsProtectionActive(false);
        setIsVerifying(false);
        setIsStuck(false);
        
        // Limpar todos os timeouts
        [protectionTimeoutRef, stuckTimerRef, resetTimeoutRef].forEach(ref => {
          if (ref.current) {
            clearTimeout(ref.current);
          }
        });
        return;
      }

      // Se leilão foi finalizado
      if (data.status === 'finished') {
        setLocalTimer(0);
        setIsProtectionActive(false);
        setIsVerifying(false);
        setIsStuck(false);
        return;
      }

      // Verificação especial quando timer está em zero
      if (localTimer <= 0 && data.status === 'active' && !isProtectionActive) {
        console.log(`🔍 [${auctionId}] Timer em zero - verificando tempo real`);
        const realTimeLeft = await fetchRealTimeLeft();
        
        if (realTimeLeft > 0) {
          console.log(`🔧 [${auctionId}] Timer travado detectado - resetando para ${realTimeLeft}s`);
          setLocalTimer(realTimeLeft);
          setIsVerifying(false);
          setIsStuck(false);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no polling:`, error);
    }
  }, [auctionId, lastBidCount, fetchRealTimeLeft, localTimer, isProtectionActive]);

  // Chamar edge function de proteção quando timer chega a zero
  const triggerProtection = useCallback(async () => {
    if (isProtectionActive) return;
    
    setIsProtectionActive(true);
    setIsVerifying(true);
    console.log(`🛡️ [${auctionId}] Timer zerou! Acionando sistema de proteção...`);

    try {
      const { error } = await supabase.functions.invoke('auction-protection', {
        body: { auction_id: auctionId }
      });

      if (error) {
        console.error(`❌ [${auctionId}] Erro na edge function de proteção:`, error);
        setIsProtectionActive(false);
        setIsVerifying(false);
      } else {
        console.log(`✅ [${auctionId}] Sistema de proteção acionado com sucesso`);
        
        // Aguardar 3 segundos e verificar se houve novo lance
        protectionTimeoutRef.current = setTimeout(async () => {
          console.log(`🔍 [${auctionId}] Verificando se proteção adicionou novo lance...`);
          
          try {
            const { data } = await supabase
              .from('auctions')
              .select('total_bids')
              .eq('id', auctionId)
              .single();
              
            if (data && data.total_bids > lastBidCount) {
              console.log(`✅ [${auctionId}] Bot adicionou lance - sincronizando timer`);
              const realTimeLeft = await fetchRealTimeLeft();
              setLocalTimer(realTimeLeft);
              setLastBidCount(data.total_bids);
            } else {
              console.log(`⚠️ [${auctionId}] Nenhum lance de proteção detectado - resetando timer`);
              const realTimeLeft = await fetchRealTimeLeft();
              setLocalTimer(realTimeLeft > 0 ? realTimeLeft : 15);
            }
          } catch (error) {
            console.error(`❌ [${auctionId}] Erro ao verificar lance de proteção:`, error);
            setLocalTimer(15); // Fallback
          } finally {
            setIsProtectionActive(false);
            setIsVerifying(false);
          }
        }, 3000);
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao acionar proteção:`, error);
      setIsProtectionActive(false);
      setIsVerifying(false);
    }
  }, [auctionId, isProtectionActive, lastBidCount, fetchRealTimeLeft]);

  // Timer decremental visual - NOVA LÓGICA: continua funcionando mesmo em zero
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // CRÍTICO: Timer sempre deve rodar se leilão está inicializado, mesmo quando em zero
    if (isInitialized) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimer(prev => {
          const newValue = Math.max(prev - 1, 0); // Não deixar ir abaixo de zero
          console.log(`⏰ [${auctionId}] Timer local: ${newValue}s${newValue === 0 ? ' (ZERO!)' : ''}`);
          
          if (newValue === 0 && prev > 0) {
            // Timer chegou a zero - acionar proteção
            triggerProtection();
            
            // Configurar reset automático se ficar travado
            resetTimeoutRef.current = setTimeout(() => {
              console.log(`🚨 [${auctionId}] Timer travado por 5s - reset automático`);
              setIsStuck(true);
              resetTimer();
            }, 5000);
          }
          
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isInitialized, auctionId, triggerProtection, fetchRealTimeLeft]);

  // Inicialização imediata do timer
  useEffect(() => {
    let isMounted = true;
    
    const initializeTimer = async () => {
      console.log(`🚀 [${auctionId}] Inicializando timer...`);
      
      try {
        // Buscar dados do leilão imediatamente
        const { data, error } = await supabase
          .from('auctions')
          .select('total_bids, status')
          .eq('id', auctionId)
          .single();

        if (!isMounted) return;

        if (data && !error) {
          setLastBidCount(data.total_bids);
          
          if (data.status === 'active') {
            // Buscar tempo real imediatamente
            const realTimeLeft = await fetchRealTimeLeft();
            if (!isMounted) return;
            
            setLocalTimer(realTimeLeft > 0 ? realTimeLeft : 15);
            console.log(`✅ [${auctionId}] Timer inicializado: ${realTimeLeft}s`);
          } else {
            setLocalTimer(0);
            console.log(`⏹️ [${auctionId}] Leilão inativo: ${data.status}`);
          }
        }
      } catch (error) {
        console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
        if (isMounted) {
          setLocalTimer(initialTimeLeft);
        }
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    // Inicializar imediatamente
    initializeTimer();

    // Polling mais frequente para timer em zero
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // Polling a cada 500ms quando timer está em zero, senão 1s
      const interval = localTimer <= 0 ? 500 : 1000;
      pollingIntervalRef.current = setInterval(checkForNewBids, interval);
    };

    startPolling();

    return () => {
      isMounted = false;
      [pollingIntervalRef, protectionTimeoutRef, stuckTimerRef, resetTimeoutRef].forEach(ref => {
        if (ref.current) {
          clearInterval(ref.current);
          clearTimeout(ref.current);
        }
      });
    };
  }, [auctionId, checkForNewBids, fetchRealTimeLeft, initialTimeLeft, localTimer]);

  return {
    localTimer,
    isProtectionActive,
    isInitialized,
    isVerifying,
    isStuck,
    resetTimer
  };
};