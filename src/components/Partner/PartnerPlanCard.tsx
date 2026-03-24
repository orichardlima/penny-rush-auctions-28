import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, TrendingUp, Wallet, Target, DollarSign, BarChart3, Zap, Minus, Plus } from 'lucide-react';
import { PartnerPlan } from '@/hooks/usePartnerContract';

interface PartnerPlanCardProps {
  plan: PartnerPlan;
  onSelect: (planId: string, cotas: number) => void;
  loading?: boolean;
  featured?: boolean;
  highlighted?: boolean;
}

export const PartnerPlanCard: React.FC<PartnerPlanCardProps> = ({ 
  plan, 
  onSelect, 
  loading = false,
  featured = false,
  highlighted = false 
}) => {
  const [cotas, setCotas] = useState(1);
  const maxCotas = plan.max_cotas || 1;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const isFeatured = featured || plan.name === 'PRO';

  // Valores proporcionais às cotas
  const totalAporte = plan.aporte_value * cotas;
  const totalWeeklyCap = plan.weekly_cap * cotas;
  const totalTotalCap = plan.total_cap * cotas;
  const totalBonusBids = (plan.bonus_bids || 0) * cotas;

  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${
      isFeatured ? 'border-primary shadow-md scale-105' : ''
    } ${highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
      {isFeatured && (
        <div className="absolute top-0 right-0">
          <Badge className="rounded-none rounded-bl-lg bg-primary">
            Mais Popular
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
        <CardDescription>Plano de Participação</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Valor do Aporte */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Aporte{cotas > 1 ? ` (${cotas} cotas)` : ''}</span>
          </div>
          <p className="text-3xl font-bold mt-1">{formatPrice(totalAporte)}</p>
          {cotas > 1 && (
            <p className="text-xs text-muted-foreground">({formatPrice(plan.aporte_value)} por cota)</p>
          )}
        </div>

        {/* Seletor de Cotas */}
        {maxCotas > 1 && (
          <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-muted-foreground">Cotas:</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCotas(Math.max(1, cotas - 1))}
                disabled={cotas <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-lg font-bold w-8 text-center">{cotas}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCotas(Math.min(maxCotas, cotas + 1))}
                disabled={cotas >= maxCotas}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">(máx {maxCotas})</span>
          </div>
        )}

        {/* Benefícios */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-green-500/10 rounded-full">
              <Target className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <span className="font-medium">Teto total de recebimento</span>
              <p className="text-sm text-primary font-semibold">{formatPrice(totalTotalCap)}</p>
              <p className="text-xs text-muted-foreground">(limitado ao desempenho da plataforma)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-blue-500/10 rounded-full">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <span className="font-medium">Limite semanal</span>
              <p className="text-xs text-muted-foreground">até {formatPrice(totalWeeklyCap)}/semana</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <span>Repasses proporcionais ao faturamento</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <span>Dashboard exclusivo de acompanhamento</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <span>Relatórios mensais detalhados</span>
          </div>

          {totalBonusBids > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="p-1.5 bg-yellow-500/10 rounded-full">
                <Zap className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <span className="font-medium">Bônus de lances</span>
                <p className="text-xs text-primary font-semibold">+{totalBonusBids} lances grátis</p>
              </div>
            </div>
          )}
        </div>

        {/* Resumo com cotas */}
        {cotas > 1 && (
          <div className="border rounded-lg p-3 space-y-1 text-sm bg-primary/5">
            <p className="font-medium text-center text-primary">
              {cotas} cotas de {plan.display_name}
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor total:</span>
              <span className="font-bold">{formatPrice(totalAporte)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ganho semanal estimado:</span>
              <span className="font-medium">até {formatPrice(totalWeeklyCap)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teto total:</span>
              <span className="font-medium">{formatPrice(totalTotalCap)}</span>
            </div>
          </div>
        )}

        {/* Botão */}
        <Button 
          className="w-full" 
          size="lg"
          variant={isFeatured ? 'default' : 'outline'}
          onClick={() => onSelect(plan.id, cotas)}
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Participar deste plano'}
        </Button>
      </CardContent>
    </Card>
  );
};
