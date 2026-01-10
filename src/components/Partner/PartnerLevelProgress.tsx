import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePartnerLevels, PartnerLevel } from '@/hooks/usePartnerLevels';
import { Trophy, Star, TrendingUp } from 'lucide-react';

interface PartnerLevelProgressProps {
  totalPoints: number;
  planName?: string;
}

const PartnerLevelProgress: React.FC<PartnerLevelProgressProps> = ({ 
  totalPoints,
  planName 
}) => {
  const { 
    levels, 
    loading, 
    getProgress, 
    getLevelColor,
    getPointsForPlan,
    levelPoints
  } = usePartnerLevels(totalPoints);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = getProgress();
  const { currentLevel, nextLevel, pointsToNextLevel, progressPercentage } = progress;

  if (!currentLevel) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Sua Graduação
        </CardTitle>
        <CardDescription>
          Indique parceiros e suba de nível para ganhar mais bônus
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Level Display */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
          <div className="text-5xl">{currentLevel.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">{currentLevel.display_name}</h3>
              {currentLevel.bonus_percentage_increase > 0 && (
                <Badge variant="secondary" className="text-xs">
                  +{currentLevel.bonus_percentage_increase}% bônus extra
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              <Star className="h-4 w-4 inline mr-1" />
              {totalPoints} pontos acumulados
            </p>
          </div>
        </div>

        {/* Progress to Next Level */}
        {nextLevel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Próximo nível: {nextLevel.icon} {nextLevel.display_name}
              </span>
              <span className="font-medium">
                {pointsToNextLevel} pts restantes
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {totalPoints} / {nextLevel.min_points} pontos
            </p>
          </div>
        )}

        {!nextLevel && (
          <div className="text-center p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-600">
              🎉 Parabéns! Você atingiu o nível máximo!
            </p>
          </div>
        )}

        {/* Points Per Plan */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pontos por indicação
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {levelPoints.map((lp) => (
              <div 
                key={lp.id} 
                className="text-center p-3 bg-muted/50 rounded-lg border"
              >
                <p className="text-lg font-bold text-primary">+{lp.points}</p>
                <p className="text-xs text-muted-foreground uppercase">{lp.plan_name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* All Levels */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Todos os níveis</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {levels.map((level) => {
              const isCurrentLevel = level.name === currentLevel.name;
              const isAchieved = totalPoints >= level.min_points;
              
              return (
                <div 
                  key={level.id} 
                  className={`relative p-3 rounded-lg border transition-all ${
                    isCurrentLevel 
                      ? 'ring-2 ring-primary bg-primary/5 border-primary' 
                      : isAchieved
                        ? 'bg-muted/50 border-muted-foreground/20'
                        : 'bg-muted/20 border-dashed opacity-60'
                  }`}
                >
                  {isCurrentLevel && (
                    <Badge 
                      className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0"
                      variant="default"
                    >
                      Atual
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{level.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{level.display_name}</p>
                      <p className="text-xs text-muted-foreground">{level.min_points} pts</p>
                    </div>
                  </div>
                  {level.bonus_percentage_increase > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      +{level.bonus_percentage_increase}% bônus
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PartnerLevelProgress;
