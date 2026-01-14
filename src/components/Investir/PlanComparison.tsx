import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, X, Crown, Target, Medal, Award, Trophy, Sparkles, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContract } from "@/hooks/usePartnerContract";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const PlanComparison = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans, loading, contract } = usePartnerContract();
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      // Usuário não logado - redirecionar para auth com redirect
      navigate(`/auth?redirect=/minha-parceria&plan=${planId}`);
      return;
    }
    
    if (contract) {
      // Usuário já tem contrato ativo
      toast({
        title: "Você já é parceiro!",
        description: `Seu contrato ${contract.plan_name} está ativo. Acesse seu dashboard para mais detalhes.`,
      });
      navigate('/minha-parceria');
      return;
    }
    
    // Usuário logado sem contrato - ir para minha-parceria com o plano
    navigate(`/minha-parceria?plan=${planId}`);
  };

  const getPlanConfig = (planName: string) => {
    switch (planName) {
      case 'start':
        return {
          icon: Medal,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-500/10',
          badge: null,
          badgeLabel: null,
          highlight: false,
          gradient: 'from-amber-700/10 to-transparent'
        };
      case 'pro':
        return {
          icon: Award,
          iconColor: 'text-slate-500',
          iconBg: 'bg-slate-400/10',
          badge: 'bg-primary text-primary-foreground',
          badgeLabel: 'Mais Popular',
          badgeIcon: Crown,
          highlight: true,
          gradient: 'from-primary/20 to-transparent'
        };
      case 'elite':
        return {
          icon: Trophy,
          iconColor: 'text-yellow-500',
          iconBg: 'bg-yellow-400/10',
          badge: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950',
          badgeLabel: 'Melhor Teto',
          badgeIcon: Trophy,
          highlight: false,
          gradient: 'from-yellow-500/20 to-transparent'
        };
      default:
        return {
          icon: Medal,
          iconColor: 'text-muted-foreground',
          iconBg: 'bg-muted',
          badge: null,
          badgeLabel: null,
          highlight: false,
          gradient: ''
        };
    }
  };

  if (loading) {
    return (
      <section id="plans" className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex gap-6 justify-center">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted h-[500px] w-80 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <TooltipProvider>
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
            Compare os planos e escolha o que melhor se adapta ao seu perfil. 
            <strong className="text-foreground"> Quanto maior o plano, maiores os limites de participação.</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
        {plans.map((plan) => {
            const config = getPlanConfig(plan.name);
            const Icon = config.icon;
            const BadgeIcon = config.badgeIcon;
            
            return (
              <Card 
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                  config.highlight 
                    ? 'border-2 border-primary shadow-lg scale-105 z-10' 
                    : 'border border-border hover:-translate-y-1'
                }`}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-b ${config.gradient} pointer-events-none`} />
                
                {/* Badge */}
                {config.badgeLabel && (
                  <div className={`absolute top-0 left-0 right-0 ${config.badge} text-center py-1.5 text-sm font-medium flex items-center justify-center gap-1.5`}>
                    {BadgeIcon && <BadgeIcon className="w-4 h-4" />}
                    {config.badgeLabel}
                  </div>
                )}

                <CardHeader className={`text-center ${config.badgeLabel ? 'pt-12' : 'pt-6'} pb-4 relative`}>
                  {/* Plan Icon */}
                  <div className={`mx-auto mb-4 p-4 rounded-full ${config.iconBg} w-fit`}>
                    <Icon className={`w-8 h-8 ${config.iconColor}`} />
                  </div>
                  
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

                <CardContent className="px-6 pb-6 relative">
                  {/* Teto do Contrato */}
                  <div className={`mb-6 p-4 rounded-xl ${config.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Target className={`w-5 h-5 ${config.highlight ? 'text-primary' : 'text-green-600'}`} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground mb-1">
                      Teto total do contrato
                    </p>
                    <p className={`text-2xl text-center font-bold ${config.highlight ? 'text-primary' : 'text-green-600'}`}>
                      Até {formatCurrency(plan.total_cap)}
                    </p>
                    <p className="text-xs text-center text-muted-foreground mt-1 leading-relaxed">
                      Valor máximo acumulado conforme desempenho da plataforma e limites semanais. 
                      Não representa garantia de recebimento.
                    </p>
                  </div>

                  {/* Plan Details */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-sm">Limite Semanal</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-center">
                            <p>O limite semanal pode ou não ser atingido, dependendo do faturamento da plataforma.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(plan.weekly_cap)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-sm">Bônus Indicação</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-center">
                            <p>Independente do contrato de participação e não interfere no teto total.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="font-semibold text-primary">
                        {plan.referral_bonus_percentage || 10}%
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-2.5 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Dashboard exclusivo</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Apuração semanal</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Relatórios detalhados</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.name !== 'elite' ? (
                        <>
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>Upgrade disponível</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          <span className="font-medium text-yellow-600">Plano máximo</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.name !== 'start' ? (
                        <>
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>Suporte prioritário</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">Suporte padrão</span>
                        </>
                      )}
                    </div>
                  </div>

                  <Button 
                    className={`w-full ${
                      config.highlight 
                        ? 'bg-gradient-to-r from-primary to-primary/80 shadow-lg' 
                        : plan.name === 'elite'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 hover:from-amber-400 hover:to-yellow-300'
                        : ''
                    }`}
                    variant={config.highlight ? 'default' : plan.name === 'elite' ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    Escolher {plan.display_name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Os valores apresentados representam limites contratuais. 
            Os repasses são proporcionais ao desempenho da plataforma e não possuem garantia de valor mínimo ou prazo.
          </p>
        </div>
      </div>
    </section>
    </TooltipProvider>
  );
};
