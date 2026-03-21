import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, TrendingUp, CheckCircle, Lock } from 'lucide-react';

interface AffiliateOnboardingProps {
  profile: { user_id: string; full_name: string | null } | null;
  seoHead: ReactNode;
  setLoading: (loading: boolean) => void;
  fetchAffiliateData: () => void;
  toast: (opts: { title: string; description: string; variant?: "default" | "destructive" }) => void;
}

export function AffiliateOnboarding({ profile, seoHead, setLoading, fetchAffiliateData, toast }: AffiliateOnboardingProps) {
  const navigate = useNavigate();
  const [hasLegend, setHasLegend] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkLegendPlan = async () => {
      if (!profile?.user_id) {
        setChecking(false);
        return;
      }

      const { data, error } = await supabase
        .from('partner_contracts')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('plan_name', 'Legend')
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();

      setHasLegend(!!data && !error);
      setChecking(false);
    };

    checkLegendPlan();
  }, [profile?.user_id]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
        {seoHead}
        <Header />
        <div className="container mx-auto px-4 py-12 flex justify-center">
          <div className="animate-pulse text-center">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verificando elegibilidade...</p>
          </div>
        </div>
      </div>
    );
  }

  // Usuário NÃO tem plano Legend ativo
  if (!hasLegend) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
        {seoHead}
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="inline-block p-4 bg-muted rounded-full mb-4">
              <Lock className="h-16 w-16 text-muted-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Programa de Afiliados
            </h1>
            <p className="text-xl text-muted-foreground">
              O programa de afiliados é exclusivo para parceiros com o plano <strong className="text-primary">Legend</strong> ativo.
            </p>
            <Card className="text-left">
              <CardHeader>
                <CardTitle>Como participar?</CardTitle>
                <CardDescription>Torne-se um parceiro Legend e desbloqueie o programa de afiliados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Com o plano Legend, você tem acesso ao programa de afiliados completo, podendo ganhar comissões sobre compras dos seus indicados e acompanhar tudo pelo painel exclusivo.
                </p>
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => navigate('/minha-parceria')}
                >
                  Conhecer os Planos de Parceiro
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Usuário TEM plano Legend -- mostrar onboarding com botão de ativação
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
      {seoHead}
      <Header />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
              <Users className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Programa de Afiliados
            </h1>
            <p className="text-xl text-muted-foreground">
              Ganhe comissões compartilhando nossos leilões com amigos e familiares!
            </p>
          </div>

          {/* Benefícios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <DollarSign className="h-12 w-12 text-primary mx-auto mb-2" />
                <CardTitle>10% de Comissão</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ganhe 10% na primeira compra realizada pelos seus indicados
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-primary mx-auto mb-2" />
                <CardTitle>Ganhos Ilimitados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sem limite de indicações. Quanto mais compartilhar, mais você ganha
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <CheckCircle className="h-12 w-12 text-primary mx-auto mb-2" />
                <CardTitle>Pagamentos Rápidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Receba suas comissões via PIX de forma rápida e segura
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Como Funciona */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Como Funciona?</CardTitle>
              <CardDescription>É simples e rápido começar a ganhar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Ative sua Conta de Afiliado</h3>
                  <p className="text-muted-foreground">Clique no botão abaixo para ativar sua conta gratuitamente e receber seu link único</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Compartilhe seu Link</h3>
                  <p className="text-muted-foreground">Envie seu link de afiliado para amigos, familiares ou nas redes sociais</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Receba Comissões</h3>
                  <p className="text-muted-foreground">Quando alguém compra usando seu link, você ganha 10% de comissão automaticamente</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Solicite o Saque</h3>
                  <p className="text-muted-foreground">Quando atingir o valor mínimo, solicite o saque e receba via PIX</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Button */}
          <div className="text-center">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={async () => {
                setLoading(true);
                const { createAffiliateAccount } = await import('@/utils/affiliateHelpers');
                const result = await createAffiliateAccount(profile!.user_id, profile!.full_name);
                
                if (result.success) {
                  toast({
                    title: "🎉 Conta de Afiliado Ativada!",
                    description: `Seu código de afiliado é: ${result.code}`,
                  });
                  fetchAffiliateData();
                } else {
                  toast({
                    title: "Erro ao Ativar Conta",
                    description: result.error || "Erro desconhecido",
                    variant: "destructive"
                  });
                  setLoading(false);
                }
              }}
            >
              <Users className="mr-2 h-5 w-5" />
              Ativar Minha Conta de Afiliado Grátis
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Sem custos, sem compromisso. Ative agora e comece a ganhar!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
