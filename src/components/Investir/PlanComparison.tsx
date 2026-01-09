import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, X, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContract } from "@/hooks/usePartnerContract";

export const PlanComparison = () => {
  const navigate = useNavigate();
  const { plans, loading } = usePartnerContract();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getReturnPercentage = (aporte: number, total: number) => {
    return ((total / aporte) * 100 - 100).toFixed(0);
  };

  const handleSelectPlan = (planId: string) => {
    navigate(`/parceiro?plan=${planId}`);
  };

  if (loading) {
    return (
      <section id="plans" className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex gap-6 justify-center">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted h-96 w-80 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="plans" className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Escolha seu Plano
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
            Planos de Parceria
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Compare os planos e escolha o que melhor se adapta ao seu perfil
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isPro = plan.name === 'pro';
            const returnPct = getReturnPercentage(plan.aporte_value, plan.total_cap);
            
            return (
              <Card 
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                  isPro 
                    ? 'border-2 border-primary shadow-lg scale-105 z-10' 
                    : 'border border-border hover:-translate-y-1'
                }`}
              >
                {isPro && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-center py-1 text-sm font-medium flex items-center justify-center gap-1">
                    <Crown className="w-4 h-4" />
                    Mais Popular
                  </div>
                )}

                <CardHeader className={`text-center ${isPro ? 'pt-10' : 'pt-6'} pb-4`}>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.display_name}
                  </h3>
                  <div className="text-4xl font-bold text-primary mb-1">
                    {formatCurrency(plan.aporte_value)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    aporte único
                  </div>
                </CardHeader>

                <CardContent className="px-6 pb-6">
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-muted-foreground">Teto Total</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(plan.total_cap)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-muted-foreground">Limite Mensal</span>
                      <span className="font-semibold">
                        {formatCurrency(plan.monthly_cap)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-muted-foreground">Retorno</span>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                        +{returnPct}%
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Dashboard exclusivo</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Repasses mensais</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Relatórios detalhados</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.name !== 'elite' ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          <span>Upgrade disponível</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Plano máximo</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.name !== 'start' ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          <span>Suporte prioritário</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Suporte padrão</span>
                        </>
                      )}
                    </div>
                  </div>

                  <Button 
                    className={`w-full ${
                      isPro 
                        ? 'bg-gradient-to-r from-primary to-primary/80' 
                        : ''
                    }`}
                    variant={isPro ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    Escolher {plan.display_name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
