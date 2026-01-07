import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Clock,
  AlertCircle,
  Gift
} from 'lucide-react';

const PartnerLanding = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { plans, loading, createContract, submitting, contract } = usePartnerContract();
  
  const [referralCode, setReferralCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Capturar código de indicação da URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode.toUpperCase());
    }
  }, [searchParams]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(value);
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      const redirectUrl = referralCode ? `/parceiro?ref=${referralCode}` : '/parceiro';
      navigate(`/auth?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }
    
    if (!acceptedTerms) {
      return;
    }
    
    const result = await createContract(planId, referralCode || undefined);
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
            <h1 className="text-3xl font-bold mb-4">Você já é um Parceiro!</h1>
            <p className="text-muted-foreground mb-6">
              Acesse seu painel para acompanhar sua participação e repasses.
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
          Programa de Parceiros
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Torne-se um{' '}
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Parceiro da Plataforma
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Participe de repasses mensais proporcionais ao faturamento, respeitando os limites do seu plano.
          Transparência total e acompanhamento em tempo real.
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
              <h3 className="text-xl font-bold mb-2">Repasses Proporcionais</h3>
              <p className="text-muted-foreground">
                Receba repasses mensais proporcionais ao faturamento da plataforma, até o teto do seu plano.
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
                Todo mês você recebe sua parte do fundo de parceiros, proporcional ao seu aporte.
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
            Selecione o plano de participação que melhor se adapta aos seus objetivos
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => {
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
                    <p className="text-muted-foreground">Plano de Participação</p>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Valor do Aporte */}
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                        <Wallet className="h-4 w-4" />
                        <span className="text-sm">Aporte</span>
                      </div>
                      <p className="text-4xl font-bold">{formatPrice(plan.aporte_value)}</p>
                    </div>

                    {/* Benefícios */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-full">
                          <Target className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Teto total de recebimento</p>
                          <p className="text-sm text-primary font-semibold">{formatPrice(plan.total_cap)}</p>
                          <p className="text-xs text-muted-foreground">(limitado ao desempenho da plataforma)</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                          <DollarSign className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Limite mensal</p>
                          <p className="text-xs text-muted-foreground">Até {formatPrice(plan.monthly_cap)}/mês</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm">Repasses proporcionais ao faturamento</span>
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
                        <span className="text-sm">Relatórios mensais detalhados</span>
                      </div>
                    </div>

                    {/* Campo de código de indicação */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Gift className="h-4 w-4" />
                        <span>Tem um código de indicação?</span>
                      </div>
                      <Input 
                        placeholder="Código de indicação (opcional)"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="font-mono"
                      />
                    </div>

                    {/* Checkbox de termos */}
                    <div className="flex items-start gap-2 pt-2">
                      <Checkbox 
                        id={`terms-${plan.id}`}
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(!!checked)}
                      />
                      <Label htmlFor={`terms-${plan.id}`} className="text-xs text-muted-foreground leading-tight cursor-pointer">
                        Li e concordo que este não é um investimento financeiro e que não há garantia de retorno. 
                        Os valores dependem exclusivamente do desempenho da plataforma.
                      </Label>
                    </div>

                    {/* Botão */}
                    <Button 
                      className="w-full" 
                      size="lg"
                      variant={isFeatured ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={submitting || (user && !acceptedTerms)}
                    >
                      {submitting ? 'Processando...' : user ? 'Participar deste plano' : 'Entrar e participar'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Texto Legal */}
        <div className="text-center text-sm text-muted-foreground mt-8 p-4 bg-muted/50 rounded-lg max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4 inline-block mr-2" />
          <p className="inline">
            Este programa não representa investimento financeiro ou promessa de rentabilidade.
            Os valores recebidos dependem exclusivamente do desempenho da plataforma.
            Não há garantia de retorno, valor mínimo ou prazo.
          </p>
        </div>
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
              Selecione o plano de participação que melhor se adequa a você
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-bold mb-2">Faça seu Aporte</h3>
            <p className="text-sm text-muted-foreground">
              Confirme seu aporte e ative seu contrato de parceiro
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-bold mb-2">Acompanhe</h3>
            <p className="text-sm text-muted-foreground">
              Repasses mensais proporcionais ao faturamento da plataforma
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h3 className="font-bold mb-2">Encerramento Automático</h3>
            <p className="text-sm text-muted-foreground">
              O contrato se encerra automaticamente ao atingir o teto do plano
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-6 text-primary" />
            <h2 className="text-3xl font-bold mb-4">Pronto para Participar?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Junte-se aos nossos parceiros e comece a receber repasses mensais hoje mesmo.
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

      {/* Footer Legal */}
      <section className="container mx-auto px-4 pb-8">
        <div className="text-center text-xs text-muted-foreground p-4 border-t">
          Este programa não representa investimento financeiro ou promessa de rentabilidade. Os valores recebidos dependem exclusivamente do desempenho da plataforma. Não há garantia de retorno, valor mínimo ou prazo.
        </div>
      </section>
    </div>
  );
};

export default PartnerLanding;