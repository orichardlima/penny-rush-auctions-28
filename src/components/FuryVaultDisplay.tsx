import React from 'react';
import { useFuryVault } from '@/hooks/useFuryVault';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Flame, Lock, Trophy, Gift, Users } from 'lucide-react';

interface FuryVaultDisplayProps {
  auctionId: string;
  auctionStatus?: string;
  totalBids?: number;
}

export const FuryVaultDisplay = ({ auctionId, auctionStatus, totalBids = 0 }: FuryVaultDisplayProps) => {
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
  } = useFuryVault(auctionId);

  if (loading || !hasVault || !config?.is_active) return null;

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);

  // Calculate progress to next increment
  const interval = config?.accumulation_interval ?? 20;
  const bidsIntoCurrentInterval = totalBids % interval;
  const progressPercent = (bidsIntoCurrentInterval / interval) * 100;
  const bidsRemaining = interval - bidsIntoCurrentInterval;

  // Finished auction: show results
  if (status === 'completed' && auctionStatus === 'finished') {
    return (
      <div className="rounded-lg border-2 border-accent/30 bg-accent/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm text-foreground">Cofre Fúria</span>
          <span className="ml-auto font-bold text-accent">{formatPrice(currentValue)}</span>
        </div>
        {instance?.top_bidder_amount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="w-3 h-3 text-yellow-500" />
            <span>Top participante: {formatPrice(instance.top_bidder_amount)}</span>
          </div>
        )}
        {instance?.raffle_winner_amount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gift className="w-3 h-3 text-primary" />
            <span>Sorteio: {formatPrice(instance.raffle_winner_amount)}</span>
          </div>
        )}
      </div>
    );
  }

  // Active/accumulating vault
  if (status !== 'accumulating') return null;

  return (
    <div
      className={`rounded-lg border-2 p-3 space-y-2 transition-all duration-300 ${
        isFuryMode
          ? 'border-destructive/60 bg-destructive/5 animate-pulse'
          : 'border-accent/30 bg-accent/5'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {isFuryMode ? (
          <Flame className="w-4 h-4 text-destructive" />
        ) : (
          <Lock className="w-4 h-4 text-accent" />
        )}
        <span className="font-semibold text-sm text-foreground">
          {isFuryMode ? '🔥 MODO FÚRIA!' : 'Cofre Fúria'}
        </span>
        <span className="ml-auto font-bold text-lg text-accent">
          {formatPrice(currentValue)}
        </span>
      </div>

      {/* Progress bar */}
      {auctionStatus === 'active' && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>
              Faltam <strong className="text-foreground">{bidsRemaining}</strong> lances para +incremento
            </span>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{qualifiedCount} qualificados</span>
            </div>
          </div>
        </div>
      )}

      {/* User qualification status */}
      {auctionStatus === 'active' && (
        <div className="flex items-center gap-2">
          {isQualified ? (
            <Badge variant="default" className="text-xs bg-success text-success-foreground">
              ✓ Você está qualificado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {userBidsInAuction}/{config?.min_bids_to_qualify ?? 15} lances para qualificar
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
