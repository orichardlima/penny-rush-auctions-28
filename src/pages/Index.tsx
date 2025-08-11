import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { AuctionCard } from "@/components/AuctionCard";
import { BidPackages } from "@/components/BidPackages";
import { HowItWorks } from "@/components/HowItWorks";
import { RecentWinners } from "@/components/RecentWinners";
import { useAuth } from "@/contexts/AuthContext";
import { useRecentBidders } from "@/hooks/useRecentBidders";
import { useToast } from "@/hooks/use-toast";
import { useAuctionTimer } from "@/hooks/useAuctionTimer";
import { transformAuctionData } from "@/lib/utils";

import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toZonedTime, format } from 'date-fns-tz';

const Index = () => {
  const [userBids, setUserBids] = useState(25); // User starts with 25 bids
  const [auctions, setAuctions] = useState<any[]>([]);
  const [bidding, setBidding] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { fetchRecentBidders } = useRecentBidders();



  const fetchAuctions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .or(`status.in.(active,waiting),and(status.eq.finished,updated_at.gte.${new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()})`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching auctions:', error);
        toast({
          title: "Erro ao carregar leilões",
          description: "Não foi possível carregar os leilões ativos.",
          variant: "destructive"
        });
        return;
      }

      // Para cada leilão, buscar os lances recentes
      const auctionsWithBidders = await Promise.all(
        (data || []).map(async (auction) => {
          const recentBidders = await fetchRecentBidders(auction.id);
          return transformAuctionData({
            ...auction,
            recentBidders
          });
        })
      );

      setAuctions(auctionsWithBidders);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  }, [toast, fetchRecentBidders]);

  // Hook para verificar e ativar leilões automaticamente
  useAuctionTimer(fetchAuctions);


  useEffect(() => {
    fetchAuctions();

    // Configurar realtime updates para leilões
    const channel = supabase
      .channel('auctions-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'auctions' },
        async (payload) => {
          console.log('🔄 Atualização de leilão recebida:', payload);
          // Buscar lances recentes atualizados
          const recentBidders = await fetchRecentBidders(payload.new.id);
          const updatedAuction = transformAuctionData({
            ...payload.new,
            recentBidders
          });
          
          setAuctions(prev => 
            prev.map(auction => 
              auction.id === updatedAuction.id ? updatedAuction : auction
            )
          );
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'auctions' },
        async (payload) => {
          console.log('✨ Novo leilão criado:', payload);
          // Buscar lances recentes para o novo leilão
          const recentBidders = await fetchRecentBidders(payload.new.id);
          const newAuction = transformAuctionData({
            ...payload.new,
            recentBidders
          });
          
          // Adicionar o novo leilão à lista se estiver ativo ou aguardando
          if (newAuction.status === 'active' || newAuction.status === 'waiting') {
            setAuctions(prev => [newAuction, ...prev]);
            
            toast({
              title: "Novo leilão disponível!",
              description: `${newAuction.title} foi adicionado aos leilões ativos.`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, fetchRecentBidders]);

  const handleBid = async (auctionId: string) => {
    // Verificar se já está processando um lance para este leilão
    if (bidding.has(auctionId)) {
      console.log('🚫 Lance já sendo processado para:', auctionId);
      return;
    }

    if (userBids <= 0) {
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
      // Verificar se o usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Faça login para dar lances",
          description: "Você precisa estar logado para participar dos leilões.",
          variant: "destructive"
        });
        return;
      }

      console.log('🎯 Enviando lance para leilão:', auctionId);

      // Inserir o lance no banco de dados
      const { error } = await supabase
        .from('bids')
        .insert({
          auction_id: auctionId,
          user_id: user.id,
          bid_amount: 1, // 1 centavo
          cost_paid: 100 // Custo do lance em centavos (R$ 1,00)
        });

      if (error) {
        console.error('❌ Erro ao registrar lance:', error);
        toast({
          title: "Erro ao dar lance",
          description: "Não foi possível registrar seu lance. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Lance registrado com sucesso');
      setUserBids(prev => prev - 1);
      
      toast({
        title: "Lance realizado!",
        description: "Seu lance foi registrado com sucesso. Boa sorte!",
        variant: "default"
      });
    } catch (error) {
      console.error('❌ Erro ao dar lance:', error);
      toast({
        title: "Erro ao dar lance",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      // Remover da lista de processamento após 2 segundos para evitar problemas
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
    window.location.href = "/pacotes";
  };

  const handlePurchasePackage = (packageId: string, bids: number) => {
    setUserBids(prev => prev + bids);
    toast({
      title: "Pacote adquirido!",
      description: `${bids} lances foram adicionados à sua conta.`,
      variant: "default"
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onBuyBids={handleBuyBids} />
      
      <main>
        <HeroSection />
        
        {/* Active Auctions Section */}
        <section className="py-16 bg-background" id="leiloes">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
                Leilões Ativos Agora
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Participe dos leilões mais quentes do momento! Cada segundo conta.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-4 text-muted-foreground">Carregando leilões...</p>
                </div>
              ) : auctions.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">Nenhum leilão disponível no momento.</p>
                </div>
              ) : (
                auctions
                  .sort((a, b) => {
                    // Ordenar: ativos, em espera, finalizados
                    const statusOrder = { active: 1, waiting: 2, finished: 3 };
                    if (statusOrder[a.auctionStatus] !== statusOrder[b.auctionStatus]) {
                      return statusOrder[a.auctionStatus] - statusOrder[b.auctionStatus];
                    }
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  })
                  .map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    id={auction.id}
                    title={auction.title}
                    image={auction.image}
                    currentPrice={auction.currentPrice}
                    originalPrice={auction.originalPrice}
                    totalBids={auction.totalBids}
                    participants={auction.participants}
                    userBids={userBids}
                    onBid={handleBid}
                    recentBidders={auction.recentBidders}
                    currentRevenue={auction.currentRevenue}
                    timeLeft={auction.timeLeft}
                    isActive={auction.isActive}
                    auctionStatus={auction.auctionStatus}
                    ends_at={auction.ends_at}
                    starts_at={auction.starts_at}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <HowItWorks />
        <BidPackages onPurchase={handlePurchasePackage} />
        <RecentWinners />
      </main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">LeilãoCentavos</h3>
              <p className="text-sm opacity-90">
                A plataforma mais emocionante de leilões do Brasil. 
                Ganhe produtos incríveis por centavos!
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Leilões</h4>
              <ul className="space-y-2 text-sm opacity-90">
                <li>Eletrônicos</li>
                <li>Casa & Decoração</li>
                <li>Moda & Beleza</li>
                <li>Esportes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm opacity-90">
                <li><Link to="/como-funciona" className="hover:text-accent transition-colors">Como Funciona</Link></li>
                <li>FAQ</li>
                <li>Contato</li>
                <li>Termos de Uso</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Segurança</h4>
              <ul className="space-y-2 text-sm opacity-90">
                <li>🔒 SSL Seguro</li>
                <li>🛡️ Dados Protegidos</li>
                <li>✅ Auditoria Externa</li>
                <li>💳 Pagamento Seguro</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-sm opacity-75">
            © 2024 LeilãoCentavos. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
