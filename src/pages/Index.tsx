import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { AuctionCard } from "@/components/AuctionCard";
import { BidPackages } from "@/components/BidPackages";
import { HowItWorks } from "@/components/HowItWorks";
import { RecentWinners } from "@/components/RecentWinners";
import { Footer } from "@/components/Footer";
import { EmptyState } from "@/components/EmptyState";
import { AuctionGridSkeleton } from "@/components/SkeletonLoading";
import { SEOHead } from "@/components/SEOHead";
import { useToast } from "@/hooks/use-toast";
import { useAuctionTimer } from "@/hooks/useAuctionTimer";
import { useRealTimeProtection } from "@/hooks/useRealTimeProtection";
import { useAuctionData } from "@/hooks/useAuctionData";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, TrendingUp, Target, DollarSign, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePurchaseProcessor } from "@/hooks/usePurchaseProcessor";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayParticipants } from "@/lib/utils";
import { getErrorToast } from "@/utils/errorHandler";

const Index = () => {
  const [bidding, setBidding] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { processPurchase } = usePurchaseProcessor();
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const { 
    auctions, 
    loading, 
    fetchAuctions, 
    updateAuction, 
    addAuction, 
    updateRecentBidders,
    setAuctions
  } = useAuctionData();

  // Hook para verificar e ativar leilões automaticamente
  useAuctionTimer(fetchAuctions);

  // Sistema de proteção em tempo real (1 segundo)
  useRealTimeProtection();

  useEffect(() => {
    fetchAuctions();

    // Configurar realtime updates para leilões e lances
    const channel = supabase
      .channel('auctions-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'auctions' },
        async (payload) => {
          await updateAuction(payload.new.id, payload.new);
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'auctions' },
        async (payload) => {
          const newAuction = await addAuction(payload.new);
          if (newAuction.status === 'active' || newAuction.status === 'waiting') {
            toast({
              title: "Novo leilão disponível!",
              description: `${newAuction.title} foi adicionado aos leilões ativos.`,
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids' },
        async (payload) => {
          const auctionId = payload.new.auction_id;
          await updateRecentBidders(auctionId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, fetchAuctions, updateAuction, addAuction, updateRecentBidders]);

  const handleBid = async (auctionId: string) => {
    // Verificar se já está processando um lance para este leilão
    if (bidding.has(auctionId)) {
      toast({
        title: "Aguarde!",
        description: "Já estamos processando um lance seu. Aguarde alguns segundos.",
        variant: "destructive"
      });
      return;
    }

    // Verificar se o usuário está autenticado
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !profile) {
      toast({
        title: "Faça login para dar lances",
        description: "Você precisa estar logado para participar dos leilões.",
        variant: "destructive"
      });
      return;
    }

    // Verificar saldo de lances do usuário
    const currentBalance = profile.bids_balance || 0;
    
    if (currentBalance < 1) {
      toast({
        title: "Sem lances disponíveis!",
        description: "Compre mais lances para continuar participando dos leilões.",
        variant: "destructive"
      });
      return;
    }

    // Marcar como processando
    setBidding(prev => new Set(prev).add(auctionId));
    
    try {
      // 1. Descontar R$ 1,00 do saldo do usuário
      const newBalance = currentBalance - 1;
      
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', user.id);

      if (balanceError) {
        toast(getErrorToast(balanceError));
        return;
      }

      // 2. Inserir o lance no banco de dados
      const { error: bidError } = await supabase
        .from('bids')
        .insert({
          auction_id: auctionId,
          user_id: user.id,
          bid_amount: 1,
          cost_paid: 1.00
        });

      if (bidError) {
        // Reverter o desconto do saldo em caso de erro
        await supabase
          .from('profiles')
          .update({ bids_balance: currentBalance })
          .eq('user_id', user.id);

        toast(getErrorToast(bidError));
        return;
      }

      // 3. Atualizar o perfil do usuário no contexto
      await refreshProfile();
    } catch (error) {
      toast(getErrorToast(error));
    } finally {
      // Remover da lista de processamento após 2 segundos
      setTimeout(() => {
        setBidding(prev => {
          const newSet = new Set(prev);
          newSet.delete(auctionId);
          return newSet;
        });
      }, 2000);
    }
  };

  const handleBuyBids = () => {
    navigate("/pacotes");
  };

  const handlePurchasePackage = async (packageId: string, bids: number, price: number) => {
    const result = await processPurchase(packageId, bids, price);
    if (result.success) {
      await refreshProfile();
      toast({
        title: "Pacote adquirido!",
        description: `${bids} lances foram adicionados à sua conta.`,
        variant: "default"
      });
    }
  };

  const sortedAuctions = [...auctions].sort((a, b) => {
    const statusOrder = { active: 1, waiting: 2, finished: 3 };
    if (statusOrder[a.auctionStatus] !== statusOrder[b.auctionStatus]) {
      return statusOrder[a.auctionStatus] - statusOrder[b.auctionStatus];
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Ganhe Produtos Incríveis por Centavos"
        description="Participe dos leilões mais emocionantes do Brasil. Cada lance custa R$ 1 e pode te dar produtos de até R$ 10.000!"
      />
      <Header onBuyBids={handleBuyBids} />
      
      <main>
        <HeroSection />
        
        {/* Active Auctions Section */}
        <section className="py-8 sm:py-12 lg:py-16 bg-background" id="leiloes">
          <div className="container mx-auto px-3 sm:px-4 lg:px-6">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 bg-gradient-primary bg-clip-text text-transparent">
                Leilões Ativos Agora
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4 sm:px-0">
                Participe dos leilões mais quentes do momento! Cada segundo conta.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {loading ? (
                <AuctionGridSkeleton />
              ) : auctions.length === 0 ? (
                <EmptyState
                  icon={Gavel}
                  title="Nenhum leilão disponível"
                  description="No momento não há leilões ativos. Volte em breve para conferir novas oportunidades incríveis!"
                  action={{
                    label: "Comprar Lances",
                    href: "/pacotes"
                  }}
                />
              ) : (
                sortedAuctions.map(auction => (
                  <AuctionCard 
                    key={auction.id} 
                    id={auction.id} 
                    title={auction.title} 
                    description={auction.description} 
                    image={auction.image} 
                    currentPrice={auction.currentPrice} 
                    originalPrice={auction.originalPrice} 
                    totalBids={auction.totalBids} 
                    participants={getDisplayParticipants(auction.totalBids, auction.participants, profile?.is_admin)} 
                    userBids={profile?.bids_balance || 0} 
                    onBid={handleBid} 
                    recentBidders={auction.recentBidders} 
                    currentRevenue={auction.currentRevenue} 
                    timeLeft={auction.timeLeft} 
                    isActive={auction.isActive} 
                    auctionStatus={auction.auctionStatus} 
                    ends_at={auction.ends_at} 
                    starts_at={auction.starts_at} 
                    finished_at={auction.finished_at} 
                    winnerId={auction.winnerId} 
                    winnerName={auction.winnerName} 
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <HowItWorks />

        {/* Partner Program Section */}
        <section className="py-12 lg:py-16 bg-gradient-to-br from-purple-500/5 via-background to-indigo-500/5">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-1 text-center lg:text-left">
                <Badge className="bg-purple-500 text-white mb-4">Exclusivo</Badge>
                <h2 className="text-3xl font-bold mb-4">
                  Seja um Parceiro Investidor
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Contribua com a plataforma e receba repasses semanais proporcionais 
                  ao faturamento. Transparência total e retornos reais.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">Repasses Semanais</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">100% Transparente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">Dashboard Exclusivo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">Encerramento Automático</span>
                  </div>
                </div>
                <Link to="/parceiro">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                    Conhecer Programa de Parceiros
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="flex-1 max-w-md w-full">
                <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20">
                  <CardContent className="p-6 space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">A partir de</p>
                      <p className="text-4xl font-bold text-purple-600">R$ 1.000</p>
                      <p className="text-sm text-muted-foreground">de aporte</p>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-purple-500" />
                          <span>Repasses semanais</span>
                        </div>
                        <span className="font-medium">Toda semana</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-purple-500" />
                          <span>Retorno potencial</span>
                        </div>
                        <span className="font-medium">Até 200% do aporte</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-purple-500" />
                          <span>Transparência</span>
                        </div>
                        <span className="font-medium">Dashboard ao vivo</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <BidPackages onPurchase={handlePurchasePackage} />
        <RecentWinners />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
