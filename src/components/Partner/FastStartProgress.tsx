import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useFastStartProgress } from '@/hooks/useFastStartProgress';
import { Rocket, Zap, Flame, Target, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface FastStartProgressProps {
  contractId: string | null;
}

const tierIcons: Record<string, React.ReactNode> = {
  'Acelerador': <Zap className="h-4 w-4" />,
  'Turbo': <Flame className="h-4 w-4" />,
  'Foguete': <Rocket className="h-4 w-4" />,
};

const FastStartProgress: React.FC<FastStartProgressProps> = ({ contractId }) => {
  const {
    isInWindow,
    daysRemaining,
    hoursRemaining,
    currentReferrals,
    tiers,
    achievements,
    currentTier,
    nextTier,
    referralsToNextTier,
    totalExtraBonus,
    loading,
  } = useFastStartProgress(contractId);

  if (loading || tiers.length === 0) return null;

  // Show component if in window OR if user has achievements (to show past results)
  const hasAchievements = achievements.length > 0;
  if (!isInWindow && !hasAchievements) return null;

  const achievedTierIds = new Set(achievements.map(a => a.tier_id));
  const sortedTiers = [...tiers].sort((a, b) => a.required_referrals - b.required_referrals);
  const maxReferrals = sortedTiers[sortedTiers.length - 1]?.required_referrals || 10;
  const progressPercent = Math.min(100, (currentReferrals / maxReferrals) * 100);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Rocket className="h-5 w-5 text-primary" />
          Bônus de Início Rápido
          {isInWindow ? (
            <Badge variant="outline" className="ml-auto text-xs font-normal gap-1">
              <Clock className="h-3 w-3" />
              {daysRemaining}d {hoursRemaining}h restantes
            </Badge>
          ) : (
            <Badge className="ml-auto bg-muted text-muted-foreground text-xs font-normal">
              Período encerrado
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              {currentReferrals} indicação{currentReferrals !== 1 ? 'ões' : ''} direta{currentReferrals !== 1 ? 's' : ''}
            </span>
            {nextTier && isInWindow && (
              <span className="text-primary font-medium">
                Mais {referralsToNextTier} para {nextTier.name}!
              </span>
            )}
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>

        {/* Tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sortedTiers.map((tier) => {
            const isAchieved = achievedTierIds.has(tier.id);
            const isCurrent = currentTier?.id === tier.id && !achievedTierIds.has(tier.id) && currentReferrals >= tier.required_referrals;
            
            return (
              <div
                key={tier.id}
                className={`relative rounded-lg p-3 border text-center transition-all ${
                  isAchieved
                    ? 'border-green-500/40 bg-green-500/10'
                    : currentReferrals >= tier.required_referrals
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-muted bg-muted/30'
                }`}
              >
                {isAchieved && (
                  <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-green-600" />
                )}
                <div className="flex items-center justify-center gap-1 mb-1">
                  {tierIcons[tier.name] || <Target className="h-4 w-4" />}
                  <span className="font-semibold text-sm">{tier.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tier.required_referrals} indicações
                </p>
                <p className="text-lg font-bold text-primary">
                  +{tier.extra_percentage}%
                </p>
              </div>
            );
          })}
        </div>

        {/* Extra bonus earned */}
        {totalExtraBonus > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">
              Bônus extra acumulado: <strong>{formatPrice(totalExtraBonus)}</strong>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FastStartProgress;
