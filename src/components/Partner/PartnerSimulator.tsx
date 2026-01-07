import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PartnerPlan } from '@/hooks/usePartnerData';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PartnerSimulatorProps {
  plans: PartnerPlan[];
}

export const PartnerSimulator = ({ plans }: PartnerSimulatorProps) => {
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(1); // Default to PRO
  const [monthlyRevenue, setMonthlyRevenue] = useState(50000);
  
  const selectedPlan = plans[selectedPlanIndex] || plans[0];
  const partnerFundPercentage = 20; // 20% do faturamento

  const simulation = useMemo(() => {
    if (!selectedPlan) return null;

    // Calcular o fundo de parceiros
    const partnerFund = (monthlyRevenue * partnerFundPercentage) / 100;
    
    // Simular que há outros parceiros (para demonstração, assumimos soma de aportes = 3x o aporte selecionado)
    const totalAportes = Number(selectedPlan.aporte_value) * 3;
    
    // Participação proporcional
    const participation = Number(selectedPlan.aporte_value) / totalAportes;
    const calculatedPayout = partnerFund * participation;
    
    // Aplicar limite mensal
    const monthlyPayout = Math.min(calculatedPayout, Number(selectedPlan.monthly_cap));
    const monthlyCapped = calculatedPayout > Number(selectedPlan.monthly_cap);
    
    // Calcular progresso mensal até o teto
    const monthlyProgressPercent = (monthlyPayout / Number(selectedPlan.total_cap)) * 100;

    return {
      partnerFund,
      participation: participation * 100,
      calculatedPayout,
      monthlyPayout,
      monthlyCapped,
      monthlyProgressPercent,
      monthsToComplete: Number(selectedPlan.total_cap) / monthlyPayout
    };
  }, [selectedPlan, monthlyRevenue, partnerFundPercentage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!selectedPlan || !simulation) return null;

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-primary" />
          Simulador de Participação
        </CardTitle>
        <CardDescription>
          Valores ilustrativos - não contratuais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Escolha o plano:</label>
          <div className="flex gap-2">
            {plans.map((plan, index) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanIndex(index)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  selectedPlanIndex === index
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {plan.display_name}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-foreground">
              Faturamento mensal simulado:
            </label>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(monthlyRevenue)}
            </span>
          </div>
          <Slider
            value={[monthlyRevenue]}
            onValueChange={(v) => setMonthlyRevenue(v[0])}
            min={10000}
            max={200000}
            step={5000}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(10000)}</span>
            <span>{formatCurrency(200000)}</span>
          </div>
        </div>

        {/* Simulation Results */}
        <div className="p-4 bg-muted/30 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Fundo de Parceiros ({partnerFundPercentage}%)</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(simulation.partnerFund)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sua Participação</p>
              <p className="text-lg font-semibold text-foreground">
                {simulation.participation.toFixed(1)}%
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Repasse estimado:</p>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(simulation.monthlyPayout)}/mês
                </p>
                {simulation.monthlyCapped && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Limite mensal aplicado
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Progress to cap */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso mensal até o teto:</span>
              <span className="font-medium">{simulation.monthlyProgressPercent.toFixed(2)}%</span>
            </div>
            <Progress value={simulation.monthlyProgressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {formatCurrency(simulation.monthlyPayout)} / {formatCurrency(Number(selectedPlan.total_cap))}
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <Alert className="bg-warning/10 border-warning/30">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs text-muted-foreground">
            <strong>Valores simulados para fins ilustrativos.</strong><br />
            Os valores reais dependem do desempenho da plataforma, quantidade de parceiros ativos 
            e outros fatores. Não há garantia de retorno ou prazo.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
