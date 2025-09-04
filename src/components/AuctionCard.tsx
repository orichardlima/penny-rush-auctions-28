import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toZonedTime, format } from 'date-fns-tz';
import { Clock, Users, TrendingUp, Gavel, Trophy } from 'lucide-react';
import { useAuctionDetail } from '@/hooks/useAuctionDetail';
import { RealtimeStatus } from '@/components/RealtimeStatus';
import { AuctionTimer } from '@/components/AuctionTimer';
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
  isActive?: boolean;
  auctionStatus?: 'waiting' | 'active' | 'finished';
  starts_at?: string;
  winnerId?: string;
  winnerName?: string;
  timeLeft?: number;
  endsAt?: string;
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
  isActive: initialIsActive = true,
  auctionStatus = 'active',
  starts_at,
  winnerId,
  winnerName,
  timeLeft,
  endsAt
}: AuctionCardProps) => {
  const [isBidding, setIsBidding] = useState(false);

  // Hook para escutar updates em tempo real do leilão
  const {
    auctionData,
    isConnected,
    lastSync,
    forceSync
  } = useAuctionDetail(id);

  const displayCurrentPrice = auctionData?.current_price ?? currentPrice;
  const displayTotalBids = auctionData?.total_bids ?? totalBids;
  const displayWinnerName = auctionData?.winner_name ?? winnerName;
  const displayStatus = auctionData?.status ?? auctionStatus;

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

  // Debug: Mostrar fonte dos dados e preço
  const dataSource = auctionData ? 'REALTIME' : 'PROPS';
  console.log(`🎯 [${id}] Status: ${displayStatus} | Source: ${dataSource}`);
  console.log(`💰 [${id}] Current Price: R$ ${displayCurrentPrice} | Original: R$ ${originalPrice}`);

  // Timer data - usar dados realtime quando disponíveis
  const displayTimeLeft = auctionData?.time_left ?? timeLeft ?? 15;
  const displayEndsAt = auctionData?.ends_at ?? endsAt;
  const {
    profile
  } = useAuth();
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

  return (
    <Card className="overflow-hidden shadow-card hover:shadow-elegant transition-all duration-300 group h-full">
      <div className="relative">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-36 sm:h-48 object-cover group-hover:scale-105 transition-transform duration-300" 
          onError={(e) => {
            console.warn('❌ Erro ao carregar imagem:', image);
            const target = e.target as HTMLImageElement;
            target.src = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'/%3e%3ccircle cx='12' cy='13' r='3'/%3e%3c/svg%3e";
            target.style.opacity = '0.3';
            target.style.backgroundColor = 'hsl(var(--muted))';
          }} 
          onLoad={() => {
            console.log('✅ Imagem carregada:', image);
          }} 
        />
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Badge 
            variant={displayStatus === 'active' ? "default" : displayStatus === 'waiting' ? "outline" : "secondary"} 
            className="shadow-md"
          >
            {displayStatus === 'waiting' ? "Aguardando" : displayStatus === 'active' ? "Ativo" : "Finalizado"}
          </Badge>
          
          {/* Timer - Só exibir para leilões ativos */}
          {displayStatus === 'active' && (
            <AuctionTimer 
              initialTimeLeft={displayTimeLeft}
              isActive={displayStatus === 'active'}
              className="self-end"
              onTimerEnd={() => {
                console.log(`⏰ [TIMER-END] Leilão ${id} (${title}) finalizado pelo timer`);
                forceSync(); // Forçar atualização quando timer acabar
              }}
            />
          )}
        </div>
      </div>
      
      <div className="p-3 sm:p-6">
        <h3 className="font-semibold text-base sm:text-lg mb-2 sm:mb-3 text-foreground">{title}</h3>
        
        {description && (
          <p className="text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
            {description}
          </p>
        )}
        
        {displayStatus === 'waiting' && starts_at && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium">
              🕒 Leilão inicia em: {formatDateTime(starts_at)}
            </p>
          </div>
        )}
        
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
            <div className="flex items-center text-muted-foreground">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              {getDisplayParticipants(displayTotalBids, participants, profile?.is_admin)} pessoas
            </div>
          </div>

          {recentBidders.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Últimos lances:</p>
              <div className="flex flex-wrap gap-1">
                {recentBidders.slice(0, 3).map((bidder, index) => (
                  <span key={index} className="text-xs bg-muted px-2 py-1 rounded-full">
                    {bidder}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Winner Section - Only show for finished auctions */}
        {displayStatus === 'finished' && displayWinnerName && (
          <div className="mb-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              <span className="font-bold text-lg text-yellow-800 dark:text-yellow-200">
                Ganhador
              </span>
            </div>
            <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
              {displayWinnerName}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
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
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {isBidding ? "PROCESSANDO..." : "DAR LANCE (R$ 1,00)"}
          </Button>
        )}

        {displayStatus === 'waiting' && (
          <Button disabled variant="outline" size="lg" className="w-full">
            <Clock className="w-4 h-4 mr-2" />
            AGUARDANDO INÍCIO
          </Button>
        )}

        {displayStatus === 'finished' && (
          <Button disabled variant="secondary" size="lg" className="w-full">
            <Trophy className="w-4 h-4 mr-2" />
            LEILÃO FINALIZADO
          </Button>
        )}

        {actualUserBids <= 0 && displayStatus === 'active' && (
          <p className="text-center text-destructive text-sm mt-2">
            Você precisa comprar lances para participar!
          </p>
        )}
      </div>
    </Card>
  );
};