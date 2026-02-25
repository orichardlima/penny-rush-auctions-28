import React, { useState, useEffect } from 'react';
import { useFuryVault } from '@/hooks/useFuryVault';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Flame, Lock, Trophy, Gift, Users, Timer, Info } from 'lucide-react';

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

  const isMobile = useIsMobile();
  const [detailsOpen, setDetailsOpen] = useState(false);
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
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-2 space-y-1">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span className="font-semibold text-xs text-foreground">Cofre Fúria</span>
          <span className="ml-auto font-bold text-sm text-accent">{formatPrice(currentValue)}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {instance?.top_bidder_amount > 0 && (
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-500" />
              Top: {formatPrice(instance.top_bidder_amount)}
            </span>
          )}
          {instance?.raffle_winner_amount > 0 && (
            <span className="flex items-center gap-1">
              <Gift className="w-3 h-3 text-primary" />
              Sorteio: {formatPrice(instance.raffle_winner_amount)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (status !== 'accumulating') return null;

  // --- Expanded details content (shared between Drawer and Dialog) ---
  const DetailsContent = () => (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-3">
        {isFuryMode ? (
          <Flame className="w-6 h-6 text-destructive" />
        ) : (
          <Lock className="w-6 h-6 text-accent" />
        )}
        <div>
          <p className="text-sm text-muted-foreground">Valor acumulado</p>
          <p className="text-2xl font-bold text-accent">{formatPrice(currentValue)}</p>
        </div>
      </div>

      {auctionStatus === 'active' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Próximo incremento</p>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Faltam <strong className="text-foreground">{bidsRemaining}</strong> lances para +incremento
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        <span><strong className="text-foreground">{qualifiedCount > 50 ? '50+' : qualifiedCount}</strong> participantes qualificados</span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Seu status</p>
        {isQualified ? (
          <Badge variant="default" className="text-xs bg-success text-success-foreground">
            ✓ Qualificado ({userBidsInAuction} lances dados)
          </Badge>
        ) : (
          <div className="space-y-1.5">
            <Badge variant="outline" className="text-xs">
              {userBidsInAuction}/{minBids} lances para qualificar
            </Badge>
            <Progress value={(userBidsInAuction / minBids) * 100} className="h-2" />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Mínimo: {minBids} lances</p>
      </div>

      {recencyCountdown !== null && recencyCountdown > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <Timer className="w-4 h-4" />
          <span>Lance nos próximos <strong>{recencyCountdown}s</strong> para manter qualificação</span>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          O Cofre Fúria acumula valor a cada {interval} lances. No final do leilão, o valor é dividido entre o top participante e um sorteio entre qualificados.
        </p>
      </div>
    </div>
  );

  // --- Compact inline display ---
  return (
    <>
      <div
        className={`rounded-lg border p-2 transition-all duration-300 ${
          isFuryMode
            ? 'border-destructive/60 bg-destructive/5'
            : 'border-accent/30 bg-accent/5'
        }`}
      >
        {/* Line 1: value + stats + details button */}
        <div className="flex items-center gap-1.5 text-xs">
          {isFuryMode ? (
            <Flame className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          )}
          <span className={`font-bold ${isFuryMode ? 'text-destructive' : 'text-accent'}`}>
            {formatPrice(currentValue)}
          </span>
          {auctionStatus === 'active' && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground whitespace-nowrap">+1 em {bidsRemaining}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground whitespace-nowrap">{qualifiedCount > 50 ? '50+' : qualifiedCount} qual.</span>
            </>
          )}
          {auctionStatus === 'active' && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-5 w-5 p-0 flex-shrink-0"
              onClick={() => setDetailsOpen(true)}
              aria-label="Detalhes do Cofre Fúria"
            >
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* Line 2: conditional status */}
        {auctionStatus === 'active' && (
          <div className="mt-1">
            {recencyCountdown !== null && recencyCountdown > 0 ? (
              <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Timer className="w-3 h-3" />
                <span>Lance em <strong>{recencyCountdown}s</strong> para manter qualificação</span>
              </div>
            ) : isQualified ? (
              <span className="text-[10px] text-success font-medium">✓ Qualificado</span>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <Progress value={(userBidsInAuction / minBids) * 100} className="h-1 flex-1" />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  Você: {userBidsInAuction}/{minBids}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded details - Drawer on mobile, Dialog on desktop */}
      {isMobile ? (
        <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                {isFuryMode ? <Flame className="w-5 h-5 text-destructive" /> : <Lock className="w-5 h-5 text-accent" />}
                {isFuryMode ? '🔥 Modo Fúria' : 'Cofre Fúria'}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">
              <DetailsContent />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isFuryMode ? <Flame className="w-5 h-5 text-destructive" /> : <Lock className="w-5 h-5 text-accent" />}
                {isFuryMode ? '🔥 Modo Fúria' : 'Cofre Fúria'}
              </DialogTitle>
            </DialogHeader>
            <DetailsContent />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
