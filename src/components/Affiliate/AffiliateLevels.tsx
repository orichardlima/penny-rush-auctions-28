import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp } from 'lucide-react';

interface Level {
  name: string;
  minConversions: number;
  maxConversions: number;
  commissionRate: number;
  icon: string;
  color: string;
}

const LEVELS: Level[] = [
  { name: 'Bronze', minConversions: 0, maxConversions: 10, commissionRate: 10, icon: '🥉', color: 'text-orange-600' },
  { name: 'Prata', minConversions: 11, maxConversions: 50, commissionRate: 12, icon: '🥈', color: 'text-gray-400' },
  { name: 'Ouro', minConversions: 51, maxConversions: 100, commissionRate: 15, icon: '🥇', color: 'text-yellow-500' },
  { name: 'Diamante', minConversions: 101, maxConversions: Infinity, commissionRate: 20, icon: '💎', color: 'text-blue-500' },
];

interface AffiliateLevelsProps {
  totalConversions: number;
  currentCommissionRate: number;
}

export function AffiliateLevels({ totalConversions, currentCommissionRate }: AffiliateLevelsProps) {
  const currentLevel = LEVELS.find(
    level => totalConversions >= level.minConversions && totalConversions <= level.maxConversions
  ) || LEVELS[0];

  const nextLevel = LEVELS.find(level => level.minConversions > totalConversions);
  
  const progressToNextLevel = nextLevel 
    ? ((totalConversions - currentLevel.minConversions) / (nextLevel.minConversions - currentLevel.minConversions)) * 100
    : 100;

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Seu Nível de Afiliado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Nível Atual */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-5xl">{currentLevel.icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-2xl font-bold ${currentLevel.color}`}>
                  {currentLevel.name}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {currentCommissionRate}% comissão
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {totalConversions} conversões realizadas
              </p>
            </div>
          </div>
        </div>

        {/* Progresso para Próximo Nível */}
        {nextLevel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progresso para {nextLevel.name}
              </span>
              <span className="font-medium">
                {totalConversions}/{nextLevel.minConversions}
              </span>
            </div>
            <Progress value={progressToNextLevel} className="h-3" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>
                Faltam apenas {nextLevel.minConversions - totalConversions} conversões para {nextLevel.name} ({nextLevel.commissionRate}% comissão)!
              </span>
            </div>
          </div>
        )}

        {/* Todos os Níveis */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Todos os Níveis</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LEVELS.map((level) => (
              <div
                key={level.name}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  level.name === currentLevel.name
                    ? 'border-primary bg-primary/5 shadow-lg scale-105'
                    : 'border-muted bg-muted/20 opacity-60'
                }`}
              >
                <div className="text-2xl mb-1">{level.icon}</div>
                <div className={`text-sm font-bold ${level.color}`}>
                  {level.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {level.commissionRate}% comissão
                </div>
                <div className="text-xs text-muted-foreground">
                  {level.maxConversions === Infinity 
                    ? `${level.minConversions}+` 
                    : `${level.minConversions}-${level.maxConversions}`
                  } conversões
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
