import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseIndependentTimerProps {
  auctionId: string;
  initialTimeLeft?: number;
}

export const useIndependentTimer = ({ auctionId, initialTimeLeft = 15 }: UseIndependentTimerProps) => {
  const [localTimer, setLocalTimer] = useState(0); // Começar em 0, será atualizado pelo backend
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isProtectionActive, setIsProtectionActive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const protectionTimeoutRef = useRef<NodeJS.Timeout>();
  const stuckTimerRef = useRef<NodeJS.Timeout>();

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

  // Polling para detectar novos lances e sincronizar timer
  const checkForNewBids = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // CRÍTICO: Sempre verificar se houve novos lances, especialmente quando timer está em zero
      if (data.total_bids > lastBidCount) {
        console.log(`🔄 [${auctionId}] Novo lance detectado! Sincronizando timer real (bids: ${lastBidCount} → ${data.total_bids})`);
        const realTimeLeft = await fetchRealTimeLeft();
        setLocalTimer(realTimeLeft);
        setLastBidCount(data.total_bids);
        setIsProtectionActive(false);
        setIsVerifying(false);
        
        // Limpar timeout de proteção se existir
        if (protectionTimeoutRef.current) {
          clearTimeout(protectionTimeoutRef.current);
        }
        
        // Limpar timeout de timer travado
        if (stuckTimerRef.current) {
          clearTimeout(stuckTimerRef.current);
        }
        return;
      }

      // Se leilão foi finalizado, parar timer
      if (data.status === 'finished') {
        setLocalTimer(0);
        setIsProtectionActive(false);
        setIsVerifying(false);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        return;
      }

      // NOVA LÓGICA: Verificação especial quando timer está em zero
      if (localTimer <= 0 && data.status === 'active' && !isProtectionActive) {
        console.log(`🔍 [${auctionId}] Timer em zero - verificando tempo real do backend`);
        const realTimeLeft = await fetchRealTimeLeft();
        
        if (realTimeLeft > 0) {
          console.log(`🔧 [${auctionId}] Timer estava travado - resetando de 0 para ${realTimeLeft}s`);
          setLocalTimer(realTimeLeft);
          setIsVerifying(false);
        }
      }

      // Verificação de consistência: se timer local difere muito do real
      if (isInitialized && data.status === 'active' && localTimer > 0 && Math.abs(Date.now() % 60000) < 1000) {
        const realTimeLeft = await fetchRealTimeLeft();
        const timeDiff = Math.abs(localTimer - realTimeLeft);
        
        if (timeDiff > 3) {
          console.log(`🔧 [${auctionId}] Correção de sincronização: ${localTimer}s → ${realTimeLeft}s (diff: ${timeDiff}s)`);
          setLocalTimer(realTimeLeft);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no polling:`, error);
    }
  }, [auctionId, lastBidCount, fetchRealTimeLeft, isInitialized, localTimer, isProtectionActive]);

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
            // Timer chegou a zero pela primeira vez - acionar proteção
            triggerProtection();
            
            // Configurar fallback de segurança para timer travado
            stuckTimerRef.current = setTimeout(() => {
              console.log(`🚨 [${auctionId}] FALLBACK: Timer travado há 5 segundos - forçando sincronização`);
              fetchRealTimeLeft().then(realTime => {
                if (realTime > 0) {
                  setLocalTimer(realTime);
                  setIsProtectionActive(false);
                  setIsVerifying(false);
                }
              });
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

  // Inicialização: buscar tempo real do backend e contagem de lances
  useEffect(() => {
    const initializeTimer = async () => {
      try {
        // Buscar dados iniciais do leilão
        const { data, error } = await supabase
          .from('auctions')
          .select('total_bids, status')
          .eq('id', auctionId)
          .single();

        if (data && !error) {
          setLastBidCount(data.total_bids);
          
          // Se leilão está ativo, buscar tempo real
          if (data.status === 'active') {
            const realTimeLeft = await fetchRealTimeLeft();
            setLocalTimer(realTimeLeft);
            console.log(`🚀 [${auctionId}] Timer inicializado com tempo real: ${realTimeLeft}s`);
          } else {
            setLocalTimer(0);
            console.log(`⏹️ [${auctionId}] Leilão não está ativo (status: ${data.status})`);
          }
        }
      } catch (error) {
        console.error(`❌ [${auctionId}] Erro ao inicializar timer:`, error);
        setLocalTimer(initialTimeLeft); // Fallback
      } finally {
        setIsInitialized(true);
      }
    };

    initializeTimer();

    // Polling a cada 1 segundo para detectar novos lances e verificar consistência
    pollingIntervalRef.current = setInterval(checkForNewBids, 1000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (protectionTimeoutRef.current) {
        clearTimeout(protectionTimeoutRef.current);
      }
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
      }
    };
  }, [auctionId, checkForNewBids, fetchRealTimeLeft, initialTimeLeft]);

  return {
    localTimer,
    isProtectionActive,
    isInitialized,
    isVerifying
  };
};