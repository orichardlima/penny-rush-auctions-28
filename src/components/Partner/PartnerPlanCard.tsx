import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, TrendingUp, Wallet, Target } from 'lucide-react';
import { PartnerPlan } from '@/hooks/usePartnerContract';

interface PartnerPlanCardProps {
  plan: PartnerPlan;
  onSelect: (planId: string) => void;
  loading?: boolean;
  featured?: boolean;
}

export const PartnerPlanCard: React.FC<PartnerPlanCardProps> = ({ 
  plan, 
  onSelect, 
  loading = false,
  featured = false 
}) => {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const returnPercentage = ((plan.total_cap / plan.aporte_value) * 100).toFixed(0);
  const isFeatured = featured || plan.name === 'PRO';

  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${
      isFeatured ? 'border-primary shadow-md scale-105' : ''
    }`}>
      {isFeatured && (
        <div className="absolute top-0 right-0">
          <Badge className="rounded-none rounded-bl-lg bg-primary">
            Mais Popular
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
        <CardDescription>Plano de Investimento</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Valor do Aporte */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Aporte</span>
          </div>
          <p className="text-3xl font-bold mt-1">{formatPrice(plan.aporte_value)}</p>
        </div>

        {/* Benefícios */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-green-500/10 rounded-full">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <span className="font-medium">Retorno de até {returnPercentage}%</span>
              <p className="text-xs text-muted-foreground">Teto: {formatPrice(plan.total_cap)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-blue-500/10 rounded-full">
              <Target className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <span className="font-medium">Limite mensal</span>
              <p className="text-xs text-muted-foreground">{formatPrice(plan.monthly_cap)}/mês</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <span>Repasses proporcionais ao faturamento</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <span>Dashboard exclusivo de acompanhamento</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <span>Relatórios mensais detalhados</span>
          </div>
        </div>

        {/* Botão */}
        <Button 
          className="w-full" 
          size="lg"
          variant={isFeatured ? 'default' : 'outline'}
          onClick={() => onSelect(plan.id)}
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Escolher Plano'}
        </Button>
      </CardContent>
    </Card>
  );
};
