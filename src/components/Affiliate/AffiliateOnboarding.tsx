import { ReactNode, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, TrendingUp, CheckCircle, Lock, Crown, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { checkAffiliateEligibility, createAffiliateAccount, type AffiliateEligibility } from '@/utils/affiliateHelpers';
import { Skeleton } from '@/components/ui/skeleton';

interface AffiliateOnboardingProps {
  profile: { user_id: string; full_name: string | null } | null;
  seoHead: ReactNode;
  setLoading: (loading: boolean) => void;
  fetchAffiliateData: () => void;
  toast: (opts: { title: string; description: string; variant?: "default" | "destructive" }) => void;
}

export function AffiliateOnboarding({ profile, seoHead, setLoading, fetchAffiliateData, toast }: AffiliateOnboardingProps) {
  const [eligibility, setEligibility] = useState<AffiliateEligibility | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!profile?.user_id) return;
    checkAffiliateEligibility(profile.user_id)
      .then(setEligibility)
      .finally(() => setChecking(false));
  }, [profile?.user_id]);

  const isManager = eligibility?.eligible === true && eligibility.role === 'manager';
  const isInfluencer = eligibility?.eligible === true && eligibility.role === 'influencer';
  const isBlocked = eligibility?.eligible === false;

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
              Programa exclusivo para Parceiros de Expansão e convidados de Gerentes de Afiliados.
            </p>
          </div>

          {/* Status de elegibilidade */}
          {checking ? (
            <Card>
              <CardContent className="p-8">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : isManager ? (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Crown className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>Você é Parceiro de Expansão!</CardTitle>
                    <CardDescription>
                      Está habilitado a ativar sua conta como <strong>Gerente de Afiliados (Manager)</strong>.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ) : isInfluencer ? (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Megaphone className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>Você foi convidado por um Gerente!</CardTitle>
                    <CardDescription>
                      Está habilitado a ativar sua conta como <strong>Influencer</strong>.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ) : isBlocked ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Lock className="h-8 w-8 text-destructive" />
                  <div>
                    <CardTitle>Acesso restrito</CardTitle>
                    <CardDescription>
                      O programa de afiliados é exclusivo para <strong>Parceiros de Expansão</strong> ou para
                      usuários convidados por um <strong>Gerente de Afiliados</strong> através de link de indicação.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/parceiro" className="flex-1">
                    <Button variant="default" className="w-full">
                      Conhecer o Plano de Parceiros de Expansão
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Benefícios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <DollarSign className="h-12 w-12 text-primary mx-auto mb-2" />
                <CardTitle>Comissões Recorrentes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ganhe na primeira compra e também nas recompras dos seus indicados.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-primary mx-auto mb-2" />
                <CardTitle>Sem Limite de Indicações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Quanto mais você divulgar, mais comissões acumula.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <CheckCircle className="h-12 w-12 text-primary mx-auto mb-2" />
                <CardTitle>Saques via PIX</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Solicite o saque das suas comissões com pagamento rápido via PIX.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Como Funciona */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Como Funciona?</CardTitle>
              <CardDescription>Dois caminhos exclusivos para entrar no programa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Parceiro de Expansão → Manager</h3>
                  <p className="text-muted-foreground">
                    Todo Parceiro de Expansão ativo pode se tornar Gerente de Afiliados, recrutar Influencers
                    e ganhar comissões diretas + override sobre seus convidados.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Convidado de Manager → Influencer</h3>
                  <p className="text-muted-foreground">
                    Se você entrou pelo link de um Gerente, pode ativar sua conta como Influencer e ganhar
                    comissões pelas indicações que trouxer.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Button */}
          {(isManager || isInfluencer) && (
            <div className="text-center">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={async () => {
                  setLoading(true);
                  const result = await createAffiliateAccount(profile!.user_id, profile!.full_name);
                  
                  if (result.success) {
                    toast({
                      title: isManager ? "🎉 Conta de Manager Ativada!" : "🎉 Conta de Influencer Ativada!",
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
                {isManager ? 'Ativar Conta de Manager' : 'Ativar Conta de Influencer'}
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Sem custos. Ative agora e comece a ganhar!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
