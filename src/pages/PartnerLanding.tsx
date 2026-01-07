import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerContract } from '@/hooks/usePartnerContract';
import { Header } from '@/components/Header';
import { 
  TrendingUp, 
  Shield, 
  DollarSign, 
  Users, 
  Target,
  Check,
  ArrowRight,
  Wallet,
  BarChart3,
  Clock
} from 'lucide-react';

const PartnerLanding = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { plans, loading, createContract, submitting, contract } = usePartnerContract();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(value);
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      navigate('/auth?redirect=/parceiro');
      return;
    }
    
    const result = await createContract(planId);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  // Se já tem contrato, redirecionar para dashboard
  if (user && contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
        <Header userBids={profile?.bids_balance || 0} onBuyBids={() => {}} />
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-green-500/10 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Você já é um Investidor!</h1>
            <p className="text-muted-foreground mb-6">
              Acesse seu painel para acompanhar seus investimentos e retornos.
            </p>
            <Link to="/dashboard">
              <Button size="lg">
                Ir para o Painel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <Header userBids={profile?.bids_balance || 0} onBuyBids={() => {}} />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Badge className="mb-4" variant="secondary">
          Programa de Investidores
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Invista e Receba até{' '}
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            200% de Retorno
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Torne-se um parceiro investidor e receba repasses mensais proporcionais ao faturamento da plataforma.
          Transparência total e retornos garantidos até o teto do seu plano.
        </p>
        <div className="flex justify-center gap-4">
          <Button size="lg" onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>
            Ver Planos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline">
            Como Funciona
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardContent className="pt-8">
              <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Retorno Garantido</h3>
              <p className="text-muted-foreground">
                Receba até 200% do valor investido através de repasses mensais proporcionais.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-8">
              <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">100% Transparente</h3>
              <p className="text-muted-foreground">
                Dashboard exclusivo para acompanhar todos os seus repasses e o progresso do contrato.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-8">
              <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Repasses Mensais</h3>
              <p className="text-muted-foreground">
                Todo mês você recebe sua parte do fundo de parceiros, proporcional ao seu investimento.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Plans Section */}
      <section id="plans" className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Escolha Seu Plano</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Selecione o plano que melhor se adapta aos seus objetivos de investimento
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => {
              const returnPercentage = ((plan.total_cap / plan.aporte_value) * 100).toFixed(0);
              const isFeatured = plan.name === 'PRO';
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative overflow-hidden transition-all hover:shadow-xl ${
                    isFeatured ? 'border-primary shadow-lg scale-105 z-10' : ''
                  }`}
                >
                  {isFeatured && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-primary">
                        Mais Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                    <p className="text-muted-foreground">Plano de Investimento</p>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Valor do Aporte */}
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                        <Wallet className="h-4 w-4" />
                        <span className="text-sm">Investimento</span>
                      </div>
                      <p className="text-4xl font-bold">{formatPrice(plan.aporte_value)}</p>
                    </div>

                    {/* Benefícios */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-full">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Retorno de até {returnPercentage}%</p>
                          <p className="text-xs text-muted-foreground">Teto: {formatPrice(plan.total_cap)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                          <Target className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Limite mensal</p>
                          <p className="text-xs text-muted-foreground">Até {formatPrice(plan.monthly_cap)}/mês</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm">Dashboard exclusivo</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm">Repasses mensais garantidos</span>
                      </div>
                    </div>

                    {/* Botão */}
                    <Button 
                      className="w-full" 
                      size="lg"
                      variant={isFeatured ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={submitting}
                    >
                      {submitting ? 'Processando...' : 'Escolher Plano'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* How it Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Como Funciona</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-bold mb-2">Escolha um Plano</h3>
            <p className="text-sm text-muted-foreground">
              Selecione o plano de investimento que melhor se adequa a você
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-bold mb-2">Faça seu Aporte</h3>
            <p className="text-sm text-muted-foreground">
              Confirme seu investimento e ative seu contrato de parceiro
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-bold mb-2">Receba Repasses</h3>
            <p className="text-sm text-muted-foreground">
              Todo mês você recebe sua parte proporcional do fundo de parceiros
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h3 className="font-bold mb-2">Até 200% de Retorno</h3>
            <p className="text-sm text-muted-foreground">
              Continue recebendo até atingir o teto do seu plano
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-6 text-primary" />
            <h2 className="text-3xl font-bold mb-4">Pronto para Investir?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Junte-se aos nossos parceiros investidores e comece a receber retornos mensais hoje mesmo.
            </p>
            <Button 
              size="lg" 
              onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Começar Agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default PartnerLanding;
