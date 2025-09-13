import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toZonedTime, format } from 'date-fns-tz';
import { differenceInHours } from 'date-fns';
import { Clock, Users, TrendingUp, Gavel, Trophy } from 'lucide-react';
import { useBackendTimer } from '@/hooks/useIndependentTimer';
import { getDisplayParticipants } from '@/lib/utils';
interface AuctionCardProps {
  id: string;
  title: string;
  description?: string;
  image: string;
  currentPrice: number;
  originalPrice: number;
  totalBids: number;
  participants: number;
  onBid: (auctionId: string) => void;
  userBids: number;
  recentBidders: string[];
  currentRevenue?: number;
  timeLeft?: number;
  isActive?: boolean;
  auctionStatus?: 'waiting' | 'active' | 'finished';
  ends_at?: string;
  starts_at?: string;
  finished_at?: string;
  winnerId?: string;
  winnerName?: string;
}
export const AuctionCard = ({
  id,
  title,
  description,
  image,
  currentPrice,
  originalPrice,
  totalBids,
  participants,
  onBid,
  userBids,
  recentBidders,
  currentRevenue = 0,
  timeLeft: initialTimeLeft = 15,
  isActive: initialIsActive = true,
  auctionStatus = 'active',
  ends_at,
  starts_at,
  finished_at,
  winnerId,
  winnerName
}: AuctionCardProps) => {
  const [isBidding, setIsBidding] = useState(false);
  
  // Estados locais que serão atualizados quando o timer resetar
  const [localCurrentPrice, setLocalCurrentPrice] = useState(currentPrice);
  const [localTotalBids, setLocalTotalBids] = useState(totalBids);
  const [localRecentBidders, setLocalRecentBidders] = useState(recentBidders);
  const [localWinnerName, setLocalWinnerName] = useState(winnerName);

  // Timer 100% controlado pelo backend
  const {
    backendTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus: backendStatus
  } = useBackendTimer({
    auctionId: id
  });

  // Função para buscar dados atualizados do leilão
  const fetchUpdatedAuctionData = async () => {
    try {
      console.log(`🔄 [${id}] Buscando dados atualizados após reset do timer...`);
      
      const { data: auction, error } = await supabase
        .from('auctions')
        .select('current_price, total_bids, winner_name')
        .eq('id', id)
        .single();

      if (error || !auction) {
        console.error(`❌ [${id}] Erro ao buscar dados atualizados:`, error);
        return;
      }

      // Buscar lances recentes
      const { data: bids } = await supabase
        .from('bids')
        .select('user_id, created_at')
        .eq('auction_id', id)
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

      // Atualizar estados locais
      setLocalCurrentPrice(auction.current_price || currentPrice);
      setLocalTotalBids(auction.total_bids || totalBids);
      setLocalRecentBidders(recentBidderNames);
      setLocalWinnerName(auction.winner_name || winnerName);

      console.log(`✅ [${id}] Dados atualizados: preço=${auction.current_price}, lances=${auction.total_bids}`);
    } catch (error) {
      console.error(`❌ [${id}] Erro ao atualizar dados:`, error);
    }
  };

  // Escutar eventos de reset do timer para atualizar dados
  useEffect(() => {
    const handleTimerReset = (event: CustomEvent) => {
      if (event.detail.auctionId === id) {
        console.log(`🔥 [${id}] Timer resetado, atualizando dados do leilão...`);
        fetchUpdatedAuctionData();
      }
    };

    window.addEventListener('auction-timer-reset', handleTimerReset as EventListener);
    
    return () => {
      window.removeEventListener('auction-timer-reset', handleTimerReset as EventListener);
    };
  }, [id]);

  // Atualizar estados locais quando props mudarem (fallback)
  useEffect(() => {
    setLocalCurrentPrice(currentPrice);
    setLocalTotalBids(totalBids);
    setLocalRecentBidders(recentBidders);
    setLocalWinnerName(winnerName);
  }, [currentPrice, totalBids, recentBidders, winnerName]);

  // Usar dados locais sincronizados
  const displayTimeLeft = isInitialized ? backendTimeLeft : initialTimeLeft;
  const displayCurrentPrice = localCurrentPrice;
  const displayTotalBids = localTotalBids;
  const displayWinnerName = localWinnerName;
  const displayStatus = isInitialized ? backendStatus : auctionStatus;

  // Função para formatar preços em reais (agora tudo está em reais)
  const formatPrice = (priceInReais: number) => {
    const safePriceInReais = priceInReais || 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safePriceInReais);
  };
  console.log(`⏰ [${id}] Backend Timer: ${displayTimeLeft}s | Verificando: ${isVerifying} | Status: ${displayStatus}`);

  // Lógica de proteção removida - agora é gerenciada inteiramente pelo backend via cron job

  // Get auth context for user bids
  const {
    profile
  } = useAuth();
  const actualUserBids = profile?.bids_balance ?? userBids;
  const handleBid = async () => {
    if (actualUserBids <= 0 || isBidding) return;
    setIsBidding(true);
    try {
      await onBid(id);
      // Não forçar timer aqui - deixar o realtime atualizar
    } finally {
      setIsBidding(false);
    }
  };
  const getTimerClasses = () => {
    if (displayTimeLeft > 10) {
      return {
        container: "bg-background border-2 border-success text-success shadow-lg",
        dot: "bg-success animate-pulse",
        animation: ""
      };
    }
    if (displayTimeLeft > 5) {
      return {
        container: "bg-background border-2 border-warning text-warning shadow-lg animate-timer-warning",
        dot: "bg-warning animate-pulse",
        animation: ""
      };
    }
    return {
      container: "bg-background border-2 border-destructive text-destructive shadow-lg animate-timer-urgent",
      dot: "bg-destructive animate-pulse",
      animation: "animate-countdown"
    };
  };
  const formatDateTime = (dateString: string) => {
    const brazilTimezone = 'America/Sao_Paulo';
    const utcDate = new Date(dateString);
    const brazilDate = toZonedTime(utcDate, brazilTimezone);
    return format(brazilDate, 'dd/MM/yyyy HH:mm', {
      timeZone: brazilTimezone
    });
  };
  const brazilTimezone = 'America/Sao_Paulo';
  const nowInBrazil = toZonedTime(new Date(), brazilTimezone);
  const startsAtInBrazil = starts_at ? toZonedTime(new Date(starts_at), brazilTimezone) : null;

  // Corrigir comparação de fuso horário
  const isAuctionStarted = !startsAtInBrazil || startsAtInBrazil <= nowInBrazil;
  console.log(`🕒 [AUCTION-CARD] ${title}:`);
  console.log(`   starts_at UTC: ${starts_at}`);
  console.log(`   starts_at BR: ${startsAtInBrazil?.toISOString()}`);
  console.log(`   now BR: ${nowInBrazil.toISOString()}`);
  console.log(`   isAuctionStarted: ${isAuctionStarted}`);
  const calculateDiscount = () => {
    // Agora ambos estão em reais
    const discount = (originalPrice - displayCurrentPrice) / originalPrice * 100;
    return Math.round(discount);
  };
  const getActiveTime = () => {
    if (!starts_at) return null;
    
    const brazilTimezone = 'America/Sao_Paulo';
    const startsAtInBrazil = toZonedTime(new Date(starts_at), brazilTimezone);
    
    let endTime;
    if (displayStatus === 'finished' && finished_at) {
      // For finished auctions, use finished_at
      endTime = toZonedTime(new Date(finished_at), brazilTimezone);
    } else if (displayStatus === 'active') {
      // For active auctions, use current time
      endTime = toZonedTime(new Date(), brazilTimezone);
    } else {
      return null;
    }
    
    const totalMinutes = Math.floor((endTime.getTime() - startsAtInBrazil.getTime()) / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  };
  return (
    <Card className="overflow-hidden shadow-card hover:shadow-elegant transition-all duration-300 group h-full">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-muted/10 to-muted/30">
        <img src={image} alt={title} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" onError={e => {
        console.warn('❌ Erro ao carregar imagem:', image);
        const target = e.target as HTMLImageElement;
        target.src = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'/%3e%3ccircle cx='12' cy='13' r='3'/%3e%3c/svg%3e";
        target.style.opacity = '0.3';
        target.style.backgroundColor = 'hsl(var(--muted))';
      }} onLoad={() => {
        console.log('✅ Imagem carregada:', image);
      }} />
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Badge variant={displayStatus === 'active' ? "default" : displayStatus === 'waiting' ? "outline" : "secondary"} className="shadow-md">
            {displayStatus === 'waiting' ? "Aguardando" : displayStatus === 'active' ? "Ativo" : "Finalizado"}
          </Badge>
          {/* Debug badge */}
          
        </div>
        {displayStatus === 'active' && <div className="absolute top-3 left-3">
            <div className="flex flex-col gap-2">
              {!isVerifying ? <div className={`rounded-xl px-4 py-3 transition-all duration-300 ${getTimerClasses().container}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getTimerClasses().dot}`}></div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-5 h-5" />
                      <span className={`font-mono font-bold text-xl ${getTimerClasses().animation}`}>
                        {displayTimeLeft}s
                      </span>
                    </div>
                  </div>
                </div> : <div className="rounded-xl px-4 py-3 bg-background border-2 border-yellow-500 text-yellow-600 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-5 h-5" />
                      <span className="font-medium text-sm">
                        Verificando lances válidos
                      </span>
                    </div>
                  </div>
                </div>}
            </div>
          </div>}
      </div>
      
      <div className="p-3 sm:p-6">
        <h3 className="font-semibold text-base sm:text-lg mb-2 sm:mb-3 text-foreground">{title}</h3>
        
        {description && <p className="text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
            {description}
          </p>}
        
        {displayStatus === 'waiting' && starts_at && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium">
              🕒 Leilão inicia em: {formatDateTime(starts_at)}
            </p>
          </div>}
        
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm sm:text-base">Preço atual:</span>
            <span className="text-xl sm:text-2xl font-bold text-primary">{formatPrice(displayCurrentPrice)}</span>
          </div>

          <div className="flex justify-between items-center text-xs sm:text-sm">
            <span className="text-muted-foreground">Valor na loja:</span>
            <span className="text-sm sm:text-lg font-semibold line-through text-muted-foreground">{formatPrice(originalPrice)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm sm:text-base">Economia:</span>
            <span className="text-base sm:text-lg font-bold text-success">{calculateDiscount()}% OFF</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center text-muted-foreground">
              <Gavel className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              {displayTotalBids} lances
            </div>
            
          </div>

          {(displayStatus === 'active' || displayStatus === 'finished') && getActiveTime() !== null && <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              {displayStatus === 'active' ? `Ativo há ${getActiveTime()}` : `Duração total: ${getActiveTime()}`}
            </div>}


          {localRecentBidders.length > 0 && <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Últimos lances:</p>
              <div className="flex flex-wrap gap-1">
                {localRecentBidders.slice(0, 3).map((bidder, index) => <span key={index} className="text-xs bg-muted px-2 py-1 rounded-full">
                    {bidder}
                  </span>)}
              </div>
            </div>}
        </div>

        {/* Winner Section - Only show for finished auctions */}
        {displayStatus === 'finished' && displayWinnerName && <div className="mb-4 bg-gradient-to-r from-yellow-400/20 to-amber-400/20 border-2 border-yellow-400/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Trophy className="h-6 w-6 text-yellow-600" />
              <span className="font-bold text-lg text-yellow-800 dark:text-yellow-200">
                Ganhador
              </span>
            </div>
            <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mb-2">
              {displayWinnerName}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Parabéns! Produto arrematado por {formatPrice(displayCurrentPrice)}
            </p>
          </div>}

        {displayStatus === 'active' && <Button onClick={handleBid} disabled={actualUserBids <= 0 || isBidding} variant={isBidding ? "success" : "bid"} size="lg" className="w-full">
            <TrendingUp className="w-4 h-4 mr-2" />
            {isBidding ? "PROCESSANDO..." : "DAR LANCE (R$ 1,00)"}
          </Button>}

        {displayStatus === 'waiting' && <Button disabled variant="outline" size="lg" className="w-full">
            <Clock className="w-4 h-4 mr-2" />
            AGUARDANDO INÍCIO
          </Button>}

        {displayStatus === 'finished' && <div className="text-center">
            <div className="bg-muted/50 text-muted-foreground py-3 px-4 rounded-lg border">
              <Trophy className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm font-medium">LEILÃO FINALIZADO</span>
            </div>
          </div>}

        {actualUserBids <= 0 && displayStatus === 'active' && <p className="text-center text-destructive text-sm mt-2">
            Você precisa comprar lances para participar!
          </p>}
      </div>
    </Card>
  );
};