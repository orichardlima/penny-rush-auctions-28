import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, TrendingUp, Users, DollarSign, CheckCircle, BarChart3, Crown, UserPlus, Unlink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatPrice } from '@/lib/utils';
import { PeriodFilter, PeriodType } from '@/components/Affiliate/PeriodFilter';
import { AdvancedMetrics } from '@/components/Affiliate/AdvancedMetrics';
import { AffiliateLevels } from '@/components/Affiliate/AffiliateLevels';
import { PerformanceChart } from '@/components/Affiliate/PerformanceChart';
import { ConversionPieChart } from '@/components/Affiliate/ConversionPieChart';
import { QRCodeModal } from '@/components/Affiliate/QRCodeModal';
import { SEOHead } from '@/components/SEOHead';
import { CPAGoalProgress } from '@/components/Affiliate/CPAGoalProgress';
import { ConversionFunnel } from '@/components/Affiliate/ConversionFunnel';
import { AffiliateReferralsList } from '@/components/Affiliate/AffiliateReferralsList';
import { Footer } from '@/components/Footer';
import { useAffiliateManager } from '@/hooks/useAffiliateManager';

interface AffiliateData {
  id: string;
  affiliate_code: string;
  status: string;
  commission_rate: number;
  commission_type: string;
  cpa_value_per_conversion: number;
  cpa_conversions_target: number;
  total_referrals: number;
  total_signups: number;
  total_conversions: number;
  commission_balance: number;
  total_commission_earned: number;
  total_commission_paid: number;
  role?: string;
}

interface CPAGoal {
  id: string;
  current_conversions: number;
  conversions_target: number;
  value_per_conversion: number;
  total_reward: number;
  status: string;
  cycle_number: number;
  started_at: string;
  completed_at?: string;
}

export default function AffiliateDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [cpaGoals, setCpaGoals] = useState<CPAGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('30d');
  const isManager = affiliateData?.role === 'manager';
  const { influencers, stats: managerStats, loading: influencersLoading, linkInfluencerByCode, unlinkMyInfluencer } = useAffiliateManager(isManager ? affiliateData?.id ?? null : null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; name: string } | null>(null);

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
        
        // Se é CPA, buscar metas
        if (data.commission_type === 'cpa') {
          const { data: goalsData, error: goalsError } = await supabase
            .from('affiliate_cpa_goals')
            .select('*')
            .eq('affiliate_id', data.id)
            .order('created_at', { ascending: false });
          
          if (!goalsError && goalsData) {
            setCpaGoals(goalsData);
          }
        }
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

  const seoHead = (
    <SEOHead 
      title="Painel do Afiliado" 
      description="Gerencie suas indicações, acompanhe suas comissões e maximize seus ganhos como afiliado do Show de Lances."
    />
  );

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
        {seoHead}
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
        {seoHead}
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

  const affiliateLink = `${window.location.origin}/?ref=${affiliateData.affiliate_code}`;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-secondary/5 to-background">
      {seoHead}
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header com Nível */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              Dashboard de Afiliado
              <span className="text-2xl">🎯</span>
            </h1>
            <p className="text-muted-foreground">
              Código: <span className="font-mono font-semibold">{affiliateData.affiliate_code}</span>
            </p>
          </div>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>

        {/* Tabs Principal */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid w-full ${isManager ? 'grid-cols-5' : 'grid-cols-4'} lg:w-auto lg:inline-grid`}>
            <TabsTrigger value="overview" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            {isManager && (
              <TabsTrigger value="influencers" className="gap-2">
                <Crown className="h-4 w-4" />
                Meus Influencers
              </TabsTrigger>
            )}
            <TabsTrigger value="referrals" className="gap-2">
              <Users className="h-4 w-4" />
              Indicados
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2">
              <Share2 className="h-4 w-4" />
              Ferramentas
            </TabsTrigger>
          </TabsList>

          {/* Tab: Visão Geral */}
          <TabsContent value="overview" className="space-y-6">
            {/* CPA Goal Progress - Se for tipo CPA */}
            {affiliateData.commission_type === 'cpa' && (
              <CPAGoalProgress
                currentConversions={cpaGoals[0]?.current_conversions ?? 0}
                targetConversions={cpaGoals[0]?.conversions_target ?? affiliateData.cpa_conversions_target}
                valuePerConversion={cpaGoals[0]?.value_per_conversion ?? affiliateData.cpa_value_per_conversion}
                cycleNumber={cpaGoals[0]?.cycle_number ?? 1}
                status={cpaGoals[0]?.status ?? 'in_progress'}
              />
            )}

            {/* Link de Indicação - Seção Destacada */}
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border-primary/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary" />
                  Seu Link de Indicação
                </CardTitle>
                <CardDescription>
                  Compartilhe este link e ganhe {affiliateData.commission_type === 'cpa' 
                    ? formatPrice(affiliateData.cpa_value_per_conversion) + ' por cada novo depositante'
                    : affiliateData.commission_rate + '% na primeira compra e comissões em recompras'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Input com o link */}
                <div className="flex gap-2">
                  <Input
                    value={affiliateLink}
                    readOnly
                    className="font-mono text-sm bg-background"
                  />
                  <Button onClick={copyAffiliateLink} variant="outline" size="icon" title="Copiar link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button onClick={shareAffiliateLink} variant="outline" size="icon" title="Compartilhar">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <QRCodeModal 
                    affiliateLink={affiliateLink}
                    affiliateCode={affiliateData.affiliate_code}
                  />
                </div>
                
                {/* Botões de ação principais */}
                <div className="flex flex-wrap gap-3">
                  <Button onClick={copyAffiliateLink} className="flex-1 min-w-[200px]">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                  </Button>
                  <Button onClick={shareAffiliateLink} variant="outline" className="flex-1 min-w-[200px]">
                    <Share2 className="mr-2 h-4 w-4" />
                    Compartilhar
                  </Button>
                </div>
                
                {/* Info do código */}
                <div className="p-3 rounded-lg bg-background/50 border text-center">
                  <span className="text-sm text-muted-foreground">Seu código: </span>
                  <span className="font-mono font-bold text-primary">{affiliateData.affiliate_code}</span>
                </div>
              </CardContent>
            </Card>
            
            {/* Cards Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
                  <DollarSign className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{formatPrice(affiliateData.commission_balance)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disponível para saque
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Ganho</CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{formatPrice(affiliateData.total_commission_earned)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Comissões totais
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cliques</CardTitle>
                  <Users className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{affiliateData.total_referrals}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    No seu link
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cadastros</CardTitle>
                  <Users className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{affiliateData.total_signups}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {affiliateData.total_referrals > 0 
                      ? `${((affiliateData.total_signups / affiliateData.total_referrals) * 100).toFixed(1)}% dos cliques`
                      : '0% dos cliques'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compradores</CardTitle>
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-600">{affiliateData.total_conversions}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {conversionRate}% taxa de conversão
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Métricas Avançadas */}
            <AdvancedMetrics 
              totalConversions={affiliateData.total_conversions}
              totalCommissionEarned={affiliateData.total_commission_earned}
              commissionBalance={affiliateData.commission_balance}
            />

            {/* Sistema de Níveis - Apenas para afiliados com comissão percentual */}
            {affiliateData.commission_type === 'percentage' && (
              <AffiliateLevels 
                totalConversions={affiliateData.total_conversions}
                currentCommissionRate={affiliateData.commission_rate}
              />
            )}

            {/* Como Funciona */}
            <Card>
              <CardHeader>
                <CardTitle>Como Funciona o Programa de Afiliados</CardTitle>
                <CardDescription>
                  Siga estes passos para maximizar seus ganhos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Compartilhe seu link</h3>
                    <p className="text-muted-foreground">
                      Divulgue seu link único nas redes sociais, WhatsApp ou qualquer outro canal
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Pessoas clicam e compram</h3>
                    <p className="text-muted-foreground">
                      Quando alguém usa seu link e compra pacotes de lances, a venda é rastreada automaticamente
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Receba sua comissão</h3>
                    <p className="text-muted-foreground">
                      {affiliateData.commission_type === 'cpa' 
                        ? `Você ganha ${formatPrice(affiliateData.cpa_value_per_conversion)} por cada depositante (primeira compra). Ao atingir ${affiliateData.cpa_conversions_target} depositantes, recebe ${formatPrice(affiliateData.cpa_value_per_conversion * affiliateData.cpa_conversions_target)}!`
                        : `Você recebe ${affiliateData.commission_rate}% de comissão sobre a primeira compra e comissões reduzidas nas recompras dos seus indicados`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Solicite o saque</h3>
                    <p className="text-muted-foreground">
                      Quando atingir o valor mínimo, solicite o pagamento via PIX e receba em até 48h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Meus Influencers (apenas para gerentes) */}
          {isManager && (
            <TabsContent value="influencers" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Influencers Ativos</CardTitle>
                    <Users className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{managerStats.totalInfluencers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Vendas da Rede</CardTitle>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{managerStats.totalNetworkSales}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Override Acumulado</CardTitle>
                    <DollarSign className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{formatPrice(managerStats.totalOverrideEarned)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Influencers Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5" />
                      Meus Influencers
                    </CardTitle>
                    <CardDescription>
                      Influencers vinculados à sua conta que divulgam por você
                    </CardDescription>
                  </div>
                  <Button onClick={() => setInviteDialogOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Convidar Influencer
                  </Button>
                </CardHeader>
                <CardContent>
                  {influencersLoading ? (
                    <p className="text-center text-muted-foreground py-8">Carregando...</p>
                  ) : influencers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum influencer vinculado ainda.</p>
                      <p className="text-sm mt-1">Use o botão acima para convidar influencers pelo código de afiliado.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Conversões</TableHead>
                          <TableHead>Comissões Geradas</TableHead>
                          <TableHead>Seu Override</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {influencers.map((inf) => (
                          <TableRow key={inf.id}>
                            <TableCell className="font-medium">{inf.full_name}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{inf.affiliate_code}</code>
                            </TableCell>
                            <TableCell>{inf.total_conversions}</TableCell>
                            <TableCell>{formatPrice(inf.total_commission_earned)}</TableCell>
                            <TableCell className="font-semibold text-primary">
                              {inf.override_rate}%
                            </TableCell>
                            <TableCell>
                              <Badge variant={inf.status === 'active' ? 'default' : 'secondary'}>
                                {inf.status === 'active' ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setUnlinkTarget({ id: inf.id, name: inf.full_name });
                                  setUnlinkDialogOpen(true);
                                }}
                                title="Desvincular influencer"
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Dialog: Convidar Influencer */}
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Convidar Influencer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Insira o código de afiliado da pessoa que deseja vincular como influencer na sua rede.
                    </p>
                    <div>
                      <label className="text-sm font-medium">Código do Afiliado</label>
                      <Input
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="Ex: ABC123"
                        className="mt-1 font-mono"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setInviteDialogOpen(false); setInviteCode(''); }}>
                      Cancelar
                    </Button>
                    <Button
                      disabled={!inviteCode.trim() || inviteLoading}
                      onClick={async () => {
                        setInviteLoading(true);
                        const success = await linkInfluencerByCode(inviteCode);
                        setInviteLoading(false);
                        if (success) {
                          setInviteDialogOpen(false);
                          setInviteCode('');
                        }
                      }}
                    >
                      {inviteLoading ? 'Vinculando...' : 'Vincular'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* AlertDialog: Desvincular */}
              <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desvincular Influencer?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja desvincular <strong>{unlinkTarget?.name}</strong> da sua rede? Esta ação pode ser refeita posteriormente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                      if (unlinkTarget) {
                        await unlinkMyInfluencer(unlinkTarget.id);
                        setUnlinkDialogOpen(false);
                        setUnlinkTarget(null);
                      }
                    }}>
                      Desvincular
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>
          )}

          {/* Tab: Indicados */}
          <TabsContent value="referrals" className="space-y-6">
            <AffiliateReferralsList affiliateId={affiliateData.id} />
          </TabsContent>

          {/* Tab: Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Funil de Conversão */}
            <ConversionFunnel
              clicks={affiliateData.total_referrals}
              signups={affiliateData.total_signups}
              buyers={affiliateData.total_conversions}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart totalCommissionEarned={affiliateData.total_commission_earned} />
              <ConversionPieChart 
                totalReferrals={affiliateData.total_signups}
                totalConversions={affiliateData.total_conversions}
              />
            </div>

            {/* Estatísticas Detalhadas */}
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas Detalhadas</CardTitle>
                <CardDescription>
                  Análise completa do seu desempenho como afiliado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Taxa de Conversão</div>
                    <div className="text-2xl font-bold">{conversionRate}%</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Comissão Média</div>
                    <div className="text-2xl font-bold">
                      {formatPrice(affiliateData.total_conversions > 0 
                        ? affiliateData.total_commission_earned / affiliateData.total_conversions 
                        : 0
                      )}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Comissões Pagas</div>
                    <div className="text-2xl font-bold">{formatPrice(affiliateData.total_commission_paid)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Taxa de Comissão</div>
                    <div className="text-2xl font-bold">{affiliateData.commission_rate}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Ferramentas */}
          <TabsContent value="tools" className="space-y-6">
            {/* Link de Afiliado com QR Code */}
            <Card>
              <CardHeader>
                <CardTitle>Seu Link de Afiliado</CardTitle>
                <CardDescription>
                  Compartilhe este link para ganhar {affiliateData.commission_rate}% de comissão na primeira compra
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={affiliateLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={copyAffiliateLink} variant="outline" size="icon">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button onClick={shareAffiliateLink} variant="outline" size="icon">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <QRCodeModal 
                    affiliateLink={affiliateLink}
                    affiliateCode={affiliateData.affiliate_code}
                  />
                </div>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm">
                    <strong className="text-primary">Seu código:</strong>{' '}
                    <span className="font-mono font-semibold">{affiliateData.affiliate_code}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Dicas de Promoção */}
            <Card>
              <CardHeader>
                <CardTitle>Dicas para Promover Melhor</CardTitle>
                <CardDescription>
                  Estratégias para aumentar suas conversões
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Use Stories e Reels</h4>
                      <p className="text-sm text-muted-foreground">
                        Crie conteúdo visual mostrando produtos e leilões ativos. Use o QR Code!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Grupos do WhatsApp</h4>
                      <p className="text-sm text-muted-foreground">
                        Compartilhe em grupos de compras e promoções. Mostre os descontos!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Conte sua história</h4>
                      <p className="text-sm text-muted-foreground">
                        Se você já ganhou, compartilhe! Histórias reais geram mais confiança.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Seja consistente</h4>
                      <p className="text-sm text-muted-foreground">
                        Publique regularmente sobre leilões ativos e produtos disponíveis.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
