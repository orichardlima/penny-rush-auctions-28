import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, TrendingUp, Users, DollarSign, CheckCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface AffiliateData {
  id: string;
  affiliate_code: string;
  status: string;
  commission_rate: number;
  total_referrals: number;
  total_conversions: number;
  commission_balance: number;
  total_commission_earned: number;
  total_commission_paid: number;
}

export default function AffiliateDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/auth');
      return;
    }

    if (profile) {
      fetchAffiliateData();
    }
  }, [profile, authLoading, navigate]);

  const fetchAffiliateData = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', profile?.user_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Não é afiliado ainda
          setAffiliateData(null);
        } else {
          throw error;
        }
      } else {
        setAffiliateData(data);
      }
    } catch (error) {
      console.error('Error fetching affiliate data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do afiliado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyAffiliateLink = () => {
    if (!affiliateData) return;
    
    const link = `${window.location.origin}/?ref=${affiliateData.affiliate_code}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: "Link copiado!",
      description: "Link de afiliado copiado para a área de transferência"
    });
  };

  const shareAffiliateLink = () => {
    if (!affiliateData) return;
    
    const link = `${window.location.origin}/?ref=${affiliateData.affiliate_code}`;
    const text = `Ganhe produtos incríveis com descontos enormes! Use meu link: ${link}`;
    
    if (navigator.share) {
      navigator.share({ title: 'Leilões', text, url: link });
    } else {
      copyAffiliateLink();
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
        <Header />
        <div className="container mx-auto px-4 py-12 flex justify-center">
          <div className="animate-pulse text-center">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  // Tela de onboarding quando usuário NÃO é afiliado
  if (!affiliateData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
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
                    Ganhe 10% em cada compra realizada pelos seus indicados
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
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Ative sua Conta de Afiliado</h3>
                    <p className="text-muted-foreground">
                      Clique no botão abaixo para ativar sua conta gratuitamente e receber seu link único
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Compartilhe seu Link</h3>
                    <p className="text-muted-foreground">
                      Envie seu link de afiliado para amigos, familiares ou nas redes sociais
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Receba Comissões</h3>
                    <p className="text-muted-foreground">
                      Quando alguém compra usando seu link, você ganha 10% de comissão automaticamente
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Solicite o Saque</h3>
                    <p className="text-muted-foreground">
                      Quando atingir o valor mínimo, solicite o saque e receba via PIX
                    </p>
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
                      description: result.error,
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

  if (affiliateData.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Aguardando Aprovação</CardTitle>
              <CardDescription>
                Sua solicitação para se tornar afiliado está {affiliateData.status === 'pending' ? 'pendente de aprovação' : 'inativa'}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/')}>Voltar para Home</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const conversionRate = affiliateData.total_referrals > 0 
    ? ((affiliateData.total_conversions / affiliateData.total_referrals) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard de Afiliado</h1>
          <p className="text-muted-foreground">
            Acompanhe suas estatísticas e ganhos como afiliado
          </p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(affiliateData.commission_balance)}</div>
              <p className="text-xs text-muted-foreground">
                Disponível para saque
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ganho</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(affiliateData.total_commission_earned)}</div>
              <p className="text-xs text-muted-foreground">
                Comissões totais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversões</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{affiliateData.total_conversions}</div>
              <p className="text-xs text-muted-foreground">
                {conversionRate}% de taxa de conversão
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Referrals</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{affiliateData.total_referrals}</div>
              <p className="text-xs text-muted-foreground">
                Cliques no seu link
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Link de Afiliado */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Seu Link de Afiliado</CardTitle>
            <CardDescription>
              Compartilhe este link para ganhar {affiliateData.commission_rate}% de comissão em cada compra
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={`${window.location.origin}/?ref=${affiliateData.affiliate_code}`}
                readOnly
                className="font-mono text-sm"
              />
              <Button onClick={copyAffiliateLink} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
              <Button onClick={shareAffiliateLink} variant="outline" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Seu código de afiliado:</p>
              <p className="text-2xl font-bold text-primary">{affiliateData.affiliate_code}</p>
            </div>
          </CardContent>
        </Card>

        {/* Informações Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Compartilhe seu link</h4>
                <p className="text-sm text-muted-foreground">
                  Envie seu link de afiliado para amigos, familiares e redes sociais
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Pessoas clicam e compram</h4>
                <p className="text-sm text-muted-foreground">
                  Quando alguém usa seu link e compra pacotes de lances, você ganha comissão
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Receba suas comissões</h4>
                <p className="text-sm text-muted-foreground">
                  Suas comissões são aprovadas automaticamente e você pode solicitar o saque a qualquer momento
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
