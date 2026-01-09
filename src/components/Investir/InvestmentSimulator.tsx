import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, Wallet, Target, ArrowRight, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContract } from "@/hooks/usePartnerContract";

export const InvestmentSimulator = () => {
  const navigate = useNavigate();
  const { plans, loading } = usePartnerContract();
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(1); // Default to PRO

  const selectedPlan = plans[selectedPlanIndex];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Calculate estimated weeks to reach total cap (based on weekly cap = monthly_cap / 4)
  const estimatedWeeks = selectedPlan 
    ? Math.ceil(selectedPlan.total_cap / (selectedPlan.monthly_cap / 4))
    : 0;

  const handleSelectPlan = () => {
    if (selectedPlan) {
      navigate(`/parceiro?plan=${selectedPlan.id}`);
    }
  };

  if (loading) {
    return (
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-pulse bg-muted h-96 rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="simulator" className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              Calculadora Interativa
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
              Simule sua Participação
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Selecione um plano e veja em tempo real os detalhes do plano
            </p>
          </div>

          <Card className="border-2 border-primary/20 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-lg text-muted-foreground">
                Escolha seu plano
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              {/* Plan selector */}
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {plans.map((plan, index) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanIndex(index)}
                    className={`relative px-6 py-3 rounded-xl font-semibold transition-all ${
                      selectedPlanIndex === index
                        ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {plan.display_name}
                    {plan.name === 'pro' && (
                      <Badge className="absolute -top-2 -right-2 bg-amber-500 text-amber-950 text-[10px]">
                        Popular
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              {selectedPlan && (
                <>
                  {/* Main stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 text-center border border-primary/10">
                      <Wallet className="w-6 h-6 text-primary mx-auto mb-2" />
                      <div className="text-sm text-muted-foreground mb-1">Aporte</div>
                      <div className="text-xl sm:text-2xl font-bold text-foreground">
                        {formatCurrency(selectedPlan.aporte_value)}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-4 text-center border border-green-500/10">
                      <Target className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <div className="text-sm text-muted-foreground mb-1">Teto Total</div>
                      <div className="text-xl sm:text-2xl font-bold text-green-600">
                        {formatCurrency(selectedPlan.total_cap)}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 text-center border border-amber-500/10">
                      <TrendingUp className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                      <div className="text-sm text-muted-foreground mb-1">Limite Semanal</div>
                      <div className="text-xl sm:text-2xl font-bold text-amber-600">
                        {formatCurrency(selectedPlan.monthly_cap / 4)}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-4 text-center border border-purple-500/10">
                      <Calendar className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <div className="text-sm text-muted-foreground mb-1">Tempo Estimado</div>
                      <div className="text-xl sm:text-2xl font-bold text-purple-600">
                        ~{estimatedWeeks} semanas
                      </div>
                    </div>
                  </div>

                  {/* Teto highlight (replaces return percentage) */}
                  <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl p-6 mb-8 text-center text-white">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Lock className="w-5 h-5" />
                      <span className="text-lg opacity-90">Teto máximo de recebimento</span>
                    </div>
                    <div className="text-4xl sm:text-5xl font-bold">{formatCurrency(selectedPlan.total_cap)}</div>
                    <div className="text-sm opacity-80 mt-2">
                      Encerramento automático ao atingir o teto
                    </div>
                  </div>

                  {/* Progress visualization */}
                  <div className="mb-8">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Início</span>
                      <span>Teto atingido</span>
                    </div>
                    <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500"
                        style={{ width: '100%' }}
                      />
                      {Array.from({ length: Math.min(estimatedWeeks, 20) }).map((_, i) => (
                        <div 
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-white/30"
                          style={{ left: `${((i + 1) / Math.min(estimatedWeeks, 20)) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Semana 1</span>
                      <span>Semana {estimatedWeeks}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <Button 
                    size="xl" 
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    onClick={handleSelectPlan}
                  >
                    Escolher Plano {selectedPlan.display_name}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  <p className="text-center text-xs text-muted-foreground mt-4">
                    *Tempo estimado baseado no recebimento máximo semanal. 
                    Os repasses dependem do desempenho da plataforma.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
