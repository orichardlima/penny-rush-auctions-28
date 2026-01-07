import { Check, Star, Zap, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PartnerPlan } from '@/hooks/usePartnerData';

interface PartnerPlansGridProps {
  plans: PartnerPlan[];
  onSelectPlan?: (plan: PartnerPlan) => void;
}

export const PartnerPlansGrid = ({ plans, onSelectPlan }: PartnerPlansGridProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toUpperCase()) {
      case 'START':
        return <Star className="h-6 w-6" />;
      case 'PRO':
        return <Zap className="h-6 w-6" />;
      case 'ELITE':
        return <Crown className="h-6 w-6" />;
      default:
        return <Star className="h-6 w-6" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName.toUpperCase()) {
      case 'START':
        return 'from-blue-500/20 to-blue-600/10 border-blue-500/30';
      case 'PRO':
        return 'from-purple-500/20 to-purple-600/10 border-purple-500/30';
      case 'ELITE':
        return 'from-amber-500/20 to-amber-600/10 border-amber-500/30';
      default:
        return 'from-primary/20 to-primary/10 border-primary/30';
    }
  };

  const getIconColor = (planName: string) => {
    switch (planName.toUpperCase()) {
      case 'START':
        return 'text-blue-500';
      case 'PRO':
        return 'text-purple-500';
      case 'ELITE':
        return 'text-amber-500';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Planos de Parceria</h2>
        <p className="text-muted-foreground mt-2">
          Escolha o plano que melhor se adapta ao seu perfil
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan, index) => (
          <Card 
            key={plan.id}
            className={`relative overflow-hidden bg-gradient-to-br ${getPlanColor(plan.name)} backdrop-blur transition-transform hover:scale-105`}
          >
            {plan.name === 'PRO' && (
              <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                Popular
              </Badge>
            )}
            
            <CardHeader className="text-center pb-2">
              <div className={`mx-auto p-3 rounded-full bg-background/50 mb-3 ${getIconColor(plan.name)}`}>
                {getPlanIcon(plan.name)}
              </div>
              <CardTitle className="text-xl">{plan.display_name}</CardTitle>
              <CardDescription>Plano de participação em receita</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-foreground">
                  {formatCurrency(Number(plan.aporte_value))}
                </span>
                <p className="text-sm text-muted-foreground">Aporte único</p>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span>Limite mensal: <strong>{formatCurrency(Number(plan.monthly_cap))}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span>Teto total: <strong>{formatCurrency(Number(plan.total_cap))}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span>Participação proporcional na receita</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span>Bônus de indicação 10%</span>
                </div>
              </div>
              
              {onSelectPlan && (
                <Button 
                  onClick={() => onSelectPlan(plan)}
                  className="w-full mt-4"
                  variant={plan.name === 'PRO' ? 'default' : 'outline'}
                >
                  Selecionar {plan.display_name}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
        ⚠️ Os valores recebidos dependem exclusivamente do desempenho da plataforma. 
        Não há garantia de retorno, rentabilidade ou prazo determinado. 
        Este não é um investimento financeiro.
      </p>
    </div>
  );
};
