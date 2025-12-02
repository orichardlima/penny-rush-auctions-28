import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatPrice } from "@/lib/utils";
import { Trophy, Target, TrendingUp } from "lucide-react";

interface CPAGoalProgressProps {
  currentConversions: number;
  targetConversions: number;
  valuePerConversion: number;
  cycleNumber: number;
  status: string;
}

export function CPAGoalProgress({ 
  currentConversions, 
  targetConversions, 
  valuePerConversion,
  cycleNumber,
  status
}: CPAGoalProgressProps) {
  const progress = (currentConversions / targetConversions) * 100;
  const remaining = targetConversions - currentConversions;
  const totalReward = valuePerConversion * targetConversions;
  const earnedSoFar = valuePerConversion * currentConversions;
  
  const isCompleted = status === 'completed';

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          {isCompleted ? `Meta ${cycleNumber} Concluída! 🎉` : `Meta Atual - Ciclo ${cycleNumber}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progresso visual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-bold text-primary">
              {currentConversions} / {targetConversions} depositantes
            </span>
          </div>
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-muted-foreground text-center">
            {isCompleted ? '✅ Meta completada!' : `${progress.toFixed(1)}% concluído`}
          </p>
        </div>

        {/* Cards de informação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Valor por depositante */}
          <div className="bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Por Depositante</span>
            </div>
            <p className="text-lg font-bold text-emerald-500">
              {formatPrice(valuePerConversion)}
            </p>
          </div>

          {/* Ganho até agora */}
          <div className="bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Ganho Atual</span>
            </div>
            <p className="text-lg font-bold text-amber-500">
              {formatPrice(earnedSoFar)}
            </p>
          </div>

          {/* Recompensa total */}
          <div className="bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Recompensa Total</span>
            </div>
            <p className="text-lg font-bold text-primary">
              {formatPrice(totalReward)}
            </p>
          </div>
        </div>

        {/* Mensagem motivacional */}
        {!isCompleted && (
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-sm font-medium">
              {remaining === 1 
                ? `🎯 Falta apenas 1 depositante para ganhar ${formatPrice(totalReward)}!`
                : `🎯 Faltam ${remaining} depositantes para ganhar ${formatPrice(totalReward)}!`
              }
            </p>
          </div>
        )}

        {isCompleted && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              🎉 Parabéns! Você ganhou {formatPrice(totalReward)}!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}