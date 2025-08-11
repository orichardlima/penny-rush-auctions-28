import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toZonedTime, format } from 'date-fns-tz';
import { Clock, Users, TrendingUp, Gavel } from 'lucide-react';
import { useAuctionRealtime } from '@/hooks/useAuctionRealtime';

interface AuctionCardProps {
  id: string;
  title: string;
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
}

export const AuctionCard = ({ 
  id, 
  title, 
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
  starts_at
}: AuctionCardProps) => {
  const [isBidding, setIsBidding] = useState(false);

  // Hook para escutar updates em tempo real do leilão
  const { auctionData } = useAuctionRealtime(id);

  // DADOS PASSIVOS: Frontend sempre respeita o backend
  // 1ª prioridade: Dados do realtime (banco de dados)
  // 2ª prioridade: Props iniciais (só para primeiro render)
  const displayTimeLeft = auctionData?.time_left ?? initialTimeLeft;
  const displayIsActive = auctionData?.status === 'active' ? auctionData.time_left > 0 : initialIsActive;
  const displayStatus = auctionData?.status ?? auctionStatus;
  const displayCurrentPrice = auctionData?.current_price ?? currentPrice;
  const displayTotalBids = auctionData?.total_bids ?? totalBids;

  // Debug: Mostrar fonte dos dados
  const dataSource = auctionData ? 'REALTIME' : 'PROPS';
  console.log(`🎯 [${id}] Timer: ${displayTimeLeft}s | Status: ${displayStatus} | Source: ${dataSource}`);

  // Lógica de proteção removida - agora é gerenciada inteiramente pelo backend via cron job

  const handleBid = async () => {
    if (userBids <= 0 || isBidding) return;
    
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatDateTime = (dateString: string) => {
    const brazilTimezone = 'America/Sao_Paulo';
    const utcDate = new Date(dateString);
    const brazilDate = toZonedTime(utcDate, brazilTimezone);
    
    return format(brazilDate, 'dd/MM/yyyy HH:mm', { timeZone: brazilTimezone });
  };

  const brazilTimezone = 'America/Sao_Paulo';
  const nowInBrazil = toZonedTime(new Date(), brazilTimezone);
  const startsAtInBrazil = starts_at ? toZonedTime(new Date(starts_at), brazilTimezone) : null;
  const isAuctionStarted = !startsAtInBrazil || startsAtInBrazil <= nowInBrazil;

  const calculateDiscount = () => {
    const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
    return Math.round(discount);
  };

  return (
    <Card className="overflow-hidden shadow-card hover:shadow-elegant transition-all duration-300 group">
      <div className="relative">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Badge 
            variant={displayStatus === 'active' ? "default" : displayStatus === 'waiting' ? "outline" : "secondary"} 
            className="shadow-md"
          >
            {displayStatus === 'waiting' ? "Aguardando" : displayStatus === 'active' ? "Ativo" : "Finalizado"}
          </Badge>
          {/* Debug badge */}
          <Badge variant="outline" className="text-xs">
            {dataSource}
          </Badge>
        </div>
        {displayStatus === 'active' && (
          <div className="absolute top-3 left-3">
            <div className={`rounded-xl px-4 py-3 transition-all duration-300 ${getTimerClasses().container}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getTimerClasses().dot}`}></div>
                <div className="flex items-center gap-1">
                  <Clock className="w-5 h-5" />
                  <span className={`font-mono font-bold text-xl ${getTimerClasses().animation}`}>
                    {displayTimeLeft}s
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="font-semibold text-lg mb-3 text-foreground">{title}</h3>
        
        {displayStatus === 'waiting' && starts_at && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium">
              🕒 Leilão inicia em: {formatDateTime(starts_at)}
            </p>
          </div>
        )}
        
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Preço atual:</span>
            <span className="text-2xl font-bold text-primary">{formatPrice(displayCurrentPrice)}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Valor na loja:</span>
            <span className="text-lg font-semibold line-through text-muted-foreground">{formatPrice(originalPrice)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Economia:</span>
            <span className="text-lg font-bold text-success">{calculateDiscount()}% OFF</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-muted-foreground">
              <Gavel className="w-4 h-4 mr-1" />
              {displayTotalBids} lances
            </div>
            <div className="flex items-center text-muted-foreground">
              <Users className="w-4 h-4 mr-1" />
              {participants} pessoas
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
                {recentBidders.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{recentBidders.length - 3} mais</span>
                )}
              </div>
            </div>
          )}
        </div>

        <Button 
          onClick={handleBid} 
          disabled={displayStatus !== 'active' || userBids <= 0 || isBidding}
          variant={isBidding ? "success" : "bid"}
          size="lg" 
          className="w-full"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          {isBidding ? "PROCESSANDO..." :
           displayStatus === 'waiting' ? "AGUARDANDO INÍCIO" : 
           displayStatus === 'active' ? "DAR LANCE (R$ 1,00)" : 
           "LEILÃO FINALIZADO"}
        </Button>

        {userBids <= 0 && displayStatus === 'active' && (
          <p className="text-center text-destructive text-sm mt-2">
            Você precisa comprar lances para participar!
          </p>
        )}
      </div>
    </Card>
  );
};