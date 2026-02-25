import React, { useState, useEffect } from 'react';
import { useFuryVault } from '@/hooks/useFuryVault';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Flame, Lock, Trophy, Gift, Users, Timer } from 'lucide-react';

interface FuryVaultDisplayProps {
  auctionId: string;
  auctionStatus?: string;
  totalBids?: number;
  endsAt?: string | null;
}

export const FuryVaultDisplay = ({ auctionId, auctionStatus, totalBids = 0, endsAt }: FuryVaultDisplayProps) => {
  const {
    hasVault,
    currentValue,
    isFuryMode,
    status,
    qualifiedCount,
    isQualified,
    userBidsInAuction,
    config,
    instance,
    loading,
    bidsUntilNextIncrement,
    recencySeconds,
  } = useFuryVault(auctionId, totalBids);

  const [recencyCountdown, setRecencyCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt || auctionStatus !== 'active' || !recencySeconds) return;

    const updateCountdown = () => {
      const endsAtDate = new Date(endsAt);
      const now = new Date();
      const secondsUntilEnd = (endsAtDate.getTime() - now.getTime()) / 1000;

      if (secondsUntilEnd > 0 && secondsUntilEnd <= recencySeconds) {
        setRecencyCountdown(Math.ceil(secondsUntilEnd));
      } else if (secondsUntilEnd > recencySeconds) {
        setRecencyCountdown(null);
      } else {
        setRecencyCountdown(0);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [endsAt, auctionStatus, recencySeconds]);

  if (loading || !hasVault || !config?.is_active) return null;

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);

  const interval = config?.accumulation_interval ?? 20;
  const bidsIntoCurrentInterval = totalBids % interval;
  const progressPercent = (bidsIntoCurrentInterval / interval) * 100;
  const bidsRemaining = bidsUntilNextIncrement;
  const minBids = config?.min_bids_to_qualify ?? 15;

  // Finished auction: compact results
  if (status === 'completed' && auctionStatus === 'finished') {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-foreground">Cofre Fúria</span>
          </div>
          <span className="font-bold text-base text-accent">{formatPrice(currentValue)}</span>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {instance?.top_bidder_amount > 0 && (
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
              Top: {formatPrice(instance.top_bidder_amount)}
            </span>
          )}
          {instance?.raffle_winner_amount > 0 && (
            <span className="flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-primary" />
              Sorteio: {formatPrice(instance.raffle_winner_amount)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (status !== 'accumulating') return null;

  return (
    <div
      className={`rounded-lg border p-3 space-y-2.5 transition-all duration-300 ${
        isFuryMode
          ? 'border-destructive/60 bg-destructive/5'
          : 'border-accent/30 bg-accent/5'
      }`}
    >
      {/* Header: title + value */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFuryMode ? (
            <Flame className="w-4 h-4 text-destructive" />
          ) : (
            <Lock className="w-4 h-4 text-accent" />
          )}
          <span className="font-semibold text-sm text-foreground">Cofre Fúria</span>
        </div>
        <span className={`font-bold text-base ${isFuryMode ? 'text-destructive' : 'text-accent'}`}>
          {formatPrice(currentValue)}
        </span>
      </div>

      {/* Fury mode badge */}
      {isFuryMode && (
        <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
          🔥 MODO FÚRIA ATIVO!
        </Badge>
      )}

      {/* Next increment progress */}
      {auctionStatus === 'active' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Próximo +R$:</span>
            <span className="font-medium text-foreground">{bidsRemaining} lances</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Qualified count + user status */}
      {auctionStatus === 'active' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{qualifiedCount > 50 ? '50+' : qualifiedCount} qualificados</span>
          </div>

          {/* Recency countdown replaces qualification status */}
          {recencyCountdown !== null && recencyCountdown > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Timer className="w-3.5 h-3.5" />
              <span>
                Lance em <strong>{recencyCountdown}s</strong> para manter sua qualificação!
              </span>
            </div>
          ) : isQualified ? (
            <div className="text-xs text-success font-medium">
              ✓ Você está qualificado ({userBidsInAuction}/{minBids} lances)
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Sua qualificação:</span>
                <span className="font-medium text-foreground">{userBidsInAuction}/{minBids}</span>
              </div>
              <Progress value={(userBidsInAuction / minBids) * 100} className="h-1.5" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
