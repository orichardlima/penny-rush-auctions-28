import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useExpansionCareer } from '@/hooks/useExpansionCareer';
import { Trophy, Star, TrendingUp } from 'lucide-react';

interface PartnerLevelProgressProps {
  totalPoints: number;
  planName?: string;
  leftPoints?: number;
  rightPoints?: number;
}

const PartnerLevelProgress: React.FC<PartnerLevelProgressProps> = ({ 
  totalPoints,
  planName,
}) => {
  const { career, loading } = useExpansionCareer();

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

  if (!career) {
    return null;
  }

  const progressPercentage = career.next_rank_required_points > 0 
    ? (career.next_rank_qualified_points / career.next_rank_required_points) * 100 
    : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Sua Evolução de Carreira
        </CardTitle>
        <CardDescription>
          Expanda sua equipe equilibradamente e alcance novos patamares no Programa de Expansão!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Level Display */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
          <div className="text-5xl">🏆</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">{career.rank_label || 'Sem graduação'}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              <Star className="h-4 w-4 inline mr-1" />
              {career.net_career_points.toLocaleString('pt-BR')} Pontos de Carreira totais
            </p>
          </div>
        </div>

        {/* Progress to Next Level */}
        {career.next_rank && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Próximo nível: {career.next_rank_label}
              </span>
              <span className="font-medium">
                {Math.max(0, career.next_rank_required_points - career.next_rank_qualified_points).toLocaleString('pt-BR')} pts válidos restantes
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {career.next_rank_qualified_points.toLocaleString('pt-BR')} / {career.next_rank_required_points.toLocaleString('pt-BR')} pontos válidos
            </p>
          </div>
        )}

        {!career.next_rank && career.rank_key !== 'NONE' && (
          <div className="text-center p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-600">
              🎉 Parabéns! Você atingiu o nível máximo da carreira!
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="p-3 bg-muted/30 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Volume Qualificado</p>
            <p className="text-lg font-bold">{career.next_rank_qualified_points.toLocaleString('pt-BR')} pts</p>
            <p className="text-[10px] text-muted-foreground">Volume contável para graduação (após concentração)</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Equipes com volume</p>
            <p className="text-lg font-bold">{career.qualified_teams}</p>
            <p className="text-[10px] text-muted-foreground">Indicações diretas qualificadas no período</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Requisitos oficiais da carreira</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(Array.isArray(career.all_ranks) ? career.all_ranks : []).map((rank: any, idx: number) => {
              const minPoints = Number(rank?.min_points) || 0;
              const isAchieved = career.rank_key !== 'NONE' && minPoints <= (career.qualified_rank_points || 0);
              const isCurrent = career.rank_key === rank?.key;
              
              return (
                <div 
                  key={rank?.key ?? idx} 
                  className={`relative p-3 rounded-lg border transition-all ${
                    isCurrent 
                      ? 'ring-2 ring-primary bg-primary/5 border-primary' 
                      : isAchieved
                        ? 'bg-muted/50 border-muted-foreground/20 opacity-80'
                        : 'bg-muted/20 border-dashed opacity-50'
                  }`}
                >
                  {isCurrent && (
                    <Badge 
                      className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0"
                      variant="default"
                    >
                      Atual
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rank?.label ?? rank?.key ?? '-'}</p>
                      <p className="text-xs text-muted-foreground">{minPoints.toLocaleString('pt-BR')} pts</p>
                    </div>
                  </div>
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
