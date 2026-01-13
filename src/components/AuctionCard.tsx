import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toZonedTime, format } from 'date-fns-tz';
import { Clock, Gavel, TrendingUp, Trophy } from 'lucide-react';
import { useBackendTimer } from '@/hooks/useIndependentTimer';

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

  // Timer e dados 100% controlados pelo backend hook
  const {
    backendTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus: backendStatus,
    currentPrice: hookCurrentPrice,
    totalBids: hookTotalBids,
    recentBidders: hookRecentBidders,
    winnerName: hookWinnerName
  } = useBackendTimer({
    auctionId: id
  });

  // Usar dados do hook quando inicializado, props como fallback
  const displayTimeLeft = isInitialized ? backendTimeLeft : initialTimeLeft;
  const displayCurrentPrice = isInitialized && hookCurrentPrice > 0 ? hookCurrentPrice : currentPrice;
  const displayTotalBids = isInitialized && hookTotalBids > 0 ? hookTotalBids : totalBids;
  const displayWinnerName = isInitialized && hookWinnerName ? hookWinnerName : winnerName;
  const displayStatus = isInitialized ? backendStatus : auctionStatus;
  const displayRecentBidders = isInitialized && hookRecentBidders.length > 0 ? hookRecentBidders : recentBidders;

  // Função para formatar preços em reais
  const formatPrice = (priceInReais: number) => {
    const safePriceInReais = priceInReais || 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safePriceInReais);
  };

  // Get auth context for user bids
  const { profile } = useAuth();
  const actualUserBids = profile?.bids_balance ?? userBids;

  const handleBid = async () => {
    if (actualUserBids <= 0 || isBidding) return;
    setIsBidding(true);
    try {
      await onBid(id);
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

  const calculateDiscount = () => {
    const discount = (originalPrice - displayCurrentPrice) / originalPrice * 100;
    return Math.round(discount);
  };

  const getActiveTime = () => {
    if (!starts_at) return null;
    
    const brazilTimezone = 'America/Sao_Paulo';
    const startsAtInBrazil = toZonedTime(new Date(starts_at), brazilTimezone);
    
    let endTime;
    if (displayStatus === 'finished' && finished_at) {
      endTime = toZonedTime(new Date(finished_at), brazilTimezone);
    } else if (displayStatus === 'active') {
      endTime = toZonedTime(new Date(), brazilTimezone);
    } else {
      return null;
    }
    
    const totalMinutes = Math.floor((endTime.getTime() - startsAtInBrazil.getTime()) / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    
    if (days > 0) {
      return `${days} dia${days > 1 ? 's' : ''} e ${hours}h ${minutes}min`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  };

  return (
    <Card 
      className="overflow-hidden shadow-card hover:shadow-elegant transition-all duration-300 group h-full"
      role="article"
      aria-labelledby={`auction-title-${id}`}
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-muted/10 to-muted/30">
        <img 
          src={image} 
          alt={`Imagem do produto: ${title}`}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" 
          onError={e => {
            const target = e.target as HTMLImageElement;
            target.src = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'/%3e%3ccircle cx='12' cy='13' r='3'/%3e%3c/svg%3e";
            target.style.opacity = '0.3';
            target.style.backgroundColor = 'hsl(var(--muted))';
          }}
        />
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Badge 
            variant={displayStatus === 'active' ? "default" : displayStatus === 'waiting' ? "outline" : "secondary"}
            aria-label={`Status do leilão: ${displayStatus === 'waiting' ? 'Aguardando início' : displayStatus === 'active' ? 'Ativo' : 'Finalizado'}`}
          >
            {displayStatus === 'waiting' ? "Aguardando" : displayStatus === 'active' ? "Ativo" : "Finalizado"}
          </Badge>
        </div>
        {displayStatus === 'active' && (
          <div className="absolute top-3 left-3">
            <div className="flex flex-col gap-2">
              {!isVerifying ? (
                <div 
                  className={`rounded-xl px-4 py-3 transition-all duration-300 ${getTimerClasses().container}`}
                  role="timer"
                  aria-live="polite"
                  aria-label={`Tempo restante: ${displayTimeLeft} segundos`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getTimerClasses().dot}`} aria-hidden="true"></div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-5 h-5" aria-hidden="true" />
                      <span className={`font-mono font-bold text-xl ${getTimerClasses().animation}`}>
                        {displayTimeLeft}s
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  className="rounded-xl px-4 py-3 bg-background border-2 border-yellow-500 text-yellow-600 shadow-lg"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" aria-hidden="true"></div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium text-sm">
                        Verificando lances válidos
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3 sm:p-6">
        <h3 
          id={`auction-title-${id}`}
          className="font-semibold text-base sm:text-lg mb-2 sm:mb-3 text-foreground"
        >
          {title}
        </h3>
        
        {description && (
          <p className="text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
            {description}
          </p>
        )}
        
        {displayStatus === 'waiting' && starts_at && (
          <div 
            className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
            role="alert"
          >
            <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              🕒 Leilão inicia em: {formatDateTime(starts_at)}
            </p>
          </div>
        )}
        
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm sm:text-base">Preço atual:</span>
            <span className="text-xl sm:text-2xl font-bold text-primary" aria-label={`Preço atual: ${formatPrice(displayCurrentPrice)}`}>
              {formatPrice(displayCurrentPrice)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs sm:text-sm">
            <span className="text-muted-foreground">Valor na loja:</span>
            <span className="text-sm sm:text-lg font-semibold line-through text-muted-foreground">
              {formatPrice(originalPrice)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm sm:text-base">Economia:</span>
            <span className="text-base sm:text-lg font-bold text-success">{calculateDiscount()}% OFF</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center text-muted-foreground">
              <Gavel className="w-3 h-3 sm:w-4 sm:h-4 mr-1" aria-hidden="true" />
              <span aria-label={`Total de ${displayTotalBids} lances`}>{displayTotalBids} lances</span>
            </div>
          </div>

          {(displayStatus === 'active' || displayStatus === 'finished') && getActiveTime() !== null && (
            displayStatus === 'active' ? (
              <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" aria-hidden="true" />
                Ativo há {getActiveTime()}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" aria-hidden="true" />
                  Duração total: {getActiveTime()}
                </div>
                {finished_at && (
                  <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" aria-hidden="true" />
                    Encerrado às {formatDateTime(finished_at)}
                  </div>
                )}
              </div>
            )
          )}

          {displayRecentBidders.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Últimos lances:</p>
              <div className="flex flex-wrap gap-1" role="list" aria-label="Últimos participantes">
                {displayRecentBidders.slice(0, 3).map((bidder, index) => (
                  <span 
                    key={index} 
                    className="text-xs bg-muted px-2 py-1 rounded-full"
                    role="listitem"
                  >
                    {bidder}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Winner Section - Only show for finished auctions */}
        {displayStatus === 'finished' && displayWinnerName && (
          <div 
            className="mb-4 bg-gradient-to-r from-yellow-400/20 to-amber-400/20 border-2 border-yellow-400/30 rounded-lg p-4 text-center"
            role="alert"
            aria-label={`Ganhador: ${displayWinnerName}`}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Trophy className="h-6 w-6 text-yellow-600" aria-hidden="true" />
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
          </div>
        )}

        {displayStatus === 'active' && (
          <Button 
            onClick={handleBid} 
            disabled={actualUserBids <= 0 || isBidding} 
            variant={isBidding ? "success" : "bid"} 
            size="lg" 
            className="w-full"
            aria-label={isBidding ? "Processando lance..." : `Dar lance de R$ 1,00 no leilão ${title}`}
            aria-busy={isBidding}
          >
            <TrendingUp className="w-4 h-4 mr-2" aria-hidden="true" />
            {isBidding ? "PROCESSANDO..." : "DAR LANCE (R$ 1,00)"}
          </Button>
        )}

        {displayStatus === 'waiting' && (
          <Button 
            disabled 
            variant="outline" 
            size="lg" 
            className="w-full"
            aria-label="Leilão aguardando início"
          >
            <Clock className="w-4 h-4 mr-2" aria-hidden="true" />
            AGUARDANDO INÍCIO
          </Button>
        )}

        {displayStatus === 'finished' && (
          <div className="text-center">
            <div 
              className="bg-muted/50 text-muted-foreground py-3 px-4 rounded-lg border"
              aria-label="Leilão finalizado"
            >
              <Trophy className="w-5 h-5 mx-auto mb-1" aria-hidden="true" />
              <span className="text-sm font-medium">LEILÃO FINALIZADO</span>
            </div>
          </div>
        )}

        {actualUserBids <= 0 && displayStatus === 'active' && (
          <p className="text-center text-destructive text-sm mt-2" role="alert">
            Você precisa comprar lances para participar!
          </p>
        )}
      </div>
    </Card>
  );
};
