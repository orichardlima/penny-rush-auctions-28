import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseIndependentTimerProps {
  auctionId: string;
  initialTimeLeft?: number;
}

export const useIndependentTimer = ({ auctionId, initialTimeLeft = 15 }: UseIndependentTimerProps) => {
  const [localTimer, setLocalTimer] = useState(initialTimeLeft);
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isProtectionActive, setIsProtectionActive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const [isExpired, setIsExpired] = useState(false); // Novo estado para leilões expirados
  
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const protectionTimeoutRef = useRef<NodeJS.Timeout>();
  const resetAttemptsRef = useRef<number>(0); // Contador de tentativas de reset
  const expiredCheckCountRef = useRef<number>(0); // Contador de verificações de expiração

  // Função para limpar todos os intervalos e timeouts
  const clearAllTimers = useCallback(() => {
    [timerIntervalRef, pollingIntervalRef, protectionTimeoutRef].forEach(ref => {
      if (ref.current) {
        clearInterval(ref.current);
        clearTimeout(ref.current);
        ref.current = undefined;
      }
    });
  }, []);

  // Função para finalizar o leilão localmente
  const finalizeAuctionLocally = useCallback(() => {
    console.log(`🏁 [${auctionId}] Finalizando leilão localmente - parando tudo`);
    setIsExpired(true);
    setLocalTimer(0);
    setIsProtectionActive(false);
    setIsVerifying(false);
    setIsStuck(false);
    clearAllTimers();
  }, [auctionId, clearAllTimers]);

  // Buscar tempo real do backend usando a nova função
  const fetchRealTimeLeft = useCallback(async () => {
    if (isExpired) return -1; // Se já marcado como expirado, não consultar backend
    
    try {
      const { data, error } = await supabase
        .rpc('get_auction_time_left', { auction_uuid: auctionId });

      if (error) {
        console.error(`❌ [${auctionId}] Erro ao buscar tempo real:`, error);
        return initialTimeLeft;
      }

      const realTimeLeft = data || 0;
      console.log(`🕐 [${auctionId}] Tempo real do backend: ${realTimeLeft}s`);
      
      // Se retornar -1, leilão deve ser finalizado
      if (realTimeLeft === -1) {
        console.log(`🏁 [${auctionId}] Backend indica que leilão deve ser finalizado`);
        expiredCheckCountRef.current += 1;
        
        // Se recebeu -1 duas vezes consecutivas, finalizar definitivamente
        if (expiredCheckCountRef.current >= 2) {
          finalizeAuctionLocally();
        }
        
        return -1;
      }
      
      // Reset contador se recebeu tempo válido
      expiredCheckCountRef.current = 0;
      return realTimeLeft;
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na RPC get_auction_time_left:`, error);
      return initialTimeLeft;
    }
  }, [auctionId, initialTimeLeft, isExpired, finalizeAuctionLocally]);

  // Função para resetar timer manualmente
  const resetTimer = useCallback(async () => {
    if (isExpired) {
      console.log(`⚠️ [${auctionId}] Tentativa de reset em leilão expirado - ignorando`);
      return;
    }
    
    resetAttemptsRef.current += 1;
    
    // Limitar tentativas de reset
    if (resetAttemptsRef.current > 3) {
      console.log(`🚨 [${auctionId}] Muitas tentativas de reset - finalizando localmente`);
      finalizeAuctionLocally();
      return;
    }
    
    console.log(`🔄 [${auctionId}] Reset manual do timer (tentativa ${resetAttemptsRef.current})`);
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
          
          if (realTimeLeft === -1 || isExpired) {
            console.log(`🏁 [${auctionId}] Leilão expirado durante reset - finalizando`);
            return; // finalizeAuctionLocally já foi chamado
          }
          
          setLocalTimer(Math.max(realTimeLeft, 0));
          resetAttemptsRef.current = 0; // Reset sucessful, clear counter
          console.log(`✅ [${auctionId}] Timer resetado para ${realTimeLeft}s`);
        } else {
          console.log(`⏹️ [${auctionId}] Leilão não está ativo: ${auction.status}`);
          setLocalTimer(0);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no reset manual:`, error);
    } finally {
      setIsProtectionActive(false);
      setIsVerifying(false);
    }
  }, [auctionId, fetchRealTimeLeft, isExpired, finalizeAuctionLocally]);

  // Polling para detectar novos lances e sincronizar timer
  const checkForNewBids = useCallback(async () => {
    if (isExpired) return; // Não fazer polling em leilões expirados
    
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // Se leilão foi finalizado no backend
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado no backend`);
        finalizeAuctionLocally();
        return;
      }

      // CRÍTICO: Sempre verificar se houve novos lances
      if (data.total_bids > lastBidCount) {
        console.log(`🔄 [${auctionId}] Novo lance detectado! Sincronizando timer (bids: ${lastBidCount} → ${data.total_bids})`);
        const realTimeLeft = await fetchRealTimeLeft();
        
        if (realTimeLeft === -1 || isExpired) {
          console.log(`🏁 [${auctionId}] Leilão expirado após novo lance`);
          return; // finalizeAuctionLocally já foi chamado se necessário
        }
        
        setLocalTimer(Math.max(realTimeLeft, 0));
        setLastBidCount(data.total_bids);
        setIsProtectionActive(false);
        setIsVerifying(false);
        setIsStuck(false);
        resetAttemptsRef.current = 0; // Reset counter on successful sync
        return;
      }

      // Verificação especial quando timer está em zero
      if (localTimer <= 0 && data.status === 'active' && !isProtectionActive) {
        console.log(`🔍 [${auctionId}] Timer em zero - verificando tempo real`);
        const realTimeLeft = await fetchRealTimeLeft();
        
        if (realTimeLeft === -1 || isExpired) {
          console.log(`🏁 [${auctionId}] Leilão expirado na verificação de timer zero`);
          return; // finalizeAuctionLocally já foi chamado se necessário
        }
        
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
  }, [auctionId, lastBidCount, fetchRealTimeLeft, localTimer, isProtectionActive, isExpired, finalizeAuctionLocally]);

  // Chamar edge function de proteção quando timer chega a zero
  const triggerProtection = useCallback(async () => {
    if (isProtectionActive || isExpired) return;
    
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
          if (isExpired) return; // Não verificar se já expirado
          
          console.log(`🔍 [${auctionId}] Verificando se proteção adicionou novo lance...`);
          
          try {
            const { data } = await supabase
              .from('auctions')
              .select('total_bids, status')
              .eq('id', auctionId)
              .single();
               
            if (data) {
              if (data.status === 'finished') {
                finalizeAuctionLocally();
                return;
              }
              
              if (data.total_bids > lastBidCount) {
                console.log(`✅ [${auctionId}] Bot adicionou lance - sincronizando timer`);
                const realTimeLeft = await fetchRealTimeLeft();
                
                if (realTimeLeft !== -1 && !isExpired) {
                  setLocalTimer(Math.max(realTimeLeft, 0));
                  setLastBidCount(data.total_bids);
                }
              } else {
                console.log(`⚠️ [${auctionId}] Nenhum lance de proteção detectado`);
                const realTimeLeft = await fetchRealTimeLeft();
                
                if (realTimeLeft === -1 || isExpired) {
                  console.log(`🏁 [${auctionId}] Leilão deve ser finalizado após proteção`);
                  return; // finalizeAuctionLocally já foi chamado se necessário
                }
                
                // Só resetar se tem tempo válido
                if (realTimeLeft > 0) {
                  setLocalTimer(realTimeLeft);
                }
              }
            }
          } catch (error) {
            console.error(`❌ [${auctionId}] Erro ao verificar lance de proteção:`, error);
          } finally {
            if (!isExpired) {
              setIsProtectionActive(false);
              setIsVerifying(false);
            }
          }
        }, 3000);
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao acionar proteção:`, error);
      setIsProtectionActive(false);
      setIsVerifying(false);
    }
  }, [auctionId, isProtectionActive, lastBidCount, fetchRealTimeLeft, isExpired, finalizeAuctionLocally]);

  // Timer decremental visual - Para quando leilão expira
  useEffect(() => {
    clearAllTimers();

    // NÃO iniciar timer se leilão está expirado
    if (isInitialized && !isExpired) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimer(prev => {
          if (isExpired) return 0; // Para se expiroul durante execução
          
          const newValue = Math.max(prev - 1, 0);
          console.log(`⏰ [${auctionId}] Timer local: ${newValue}s${newValue === 0 ? ' (ZERO!)' : ''}`);
          
          if (newValue === 0 && prev > 0) {
            // Timer chegou a zero - acionar proteção
            triggerProtection();
          }
          
          return newValue;
        });
      }, 1000);
    }

    return clearAllTimers;
  }, [isInitialized, isExpired, auctionId, triggerProtection, clearAllTimers]);

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
          
          if (data.status === 'finished') {
            console.log(`🏁 [${auctionId}] Leilão já finalizado na inicialização`);
            if (isMounted) {
              setIsExpired(true);
              setLocalTimer(0);
            }
          } else if (data.status === 'active') {
            // Buscar tempo real imediatamente
            const realTimeLeft = await fetchRealTimeLeft();
            if (!isMounted) return;
            
            if (realTimeLeft === -1 || isExpired) {
              console.log(`🏁 [${auctionId}] Leilão deve ser finalizado na inicialização`);
              if (isMounted) {
                setIsExpired(true);
                setLocalTimer(0);
              }
            } else {
              setLocalTimer(Math.max(realTimeLeft, 0));
              resetAttemptsRef.current = 0;
              console.log(`✅ [${auctionId}] Timer inicializado: ${realTimeLeft}s`);
            }
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

    // Polling apenas se não expirado
    const startPolling = () => {
      if (isExpired) return;
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // Polling mais frequente quando timer está baixo
      const interval = localTimer <= 3 ? 500 : 1000;
      pollingIntervalRef.current = setInterval(checkForNewBids, interval);
    };

    if (isInitialized) {
      startPolling();
    }

    return () => {
      isMounted = false;
      clearAllTimers();
    };
  }, [auctionId, checkForNewBids, fetchRealTimeLeft, initialTimeLeft, localTimer, isInitialized, isExpired, clearAllTimers]);

  return {
    localTimer,
    isProtectionActive,
    isInitialized,
    isVerifying,
    isStuck,
    isExpired, // Novo estado exportado
    resetTimer
  };
};