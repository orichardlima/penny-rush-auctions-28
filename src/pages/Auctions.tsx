import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { AuctionCard } from "@/components/AuctionCard";
import { AuctionFilters } from "@/components/AuctionFilters";
import { Footer } from "@/components/Footer";
import { EmptyState } from "@/components/EmptyState";
import { AuctionGridSkeleton } from "@/components/SkeletonLoading";
import { useToast } from "@/hooks/use-toast";
import { useAuctionTimer } from "@/hooks/useAuctionTimer";
import { useAuctionFilters } from "@/hooks/useAuctionFilters";
import { useAuctionData } from "@/hooks/useAuctionData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { getDisplayParticipants } from "@/lib/utils";
import { getErrorToast } from "@/utils/errorHandler";
import { Gavel } from "lucide-react";

const Auctions = () => {
  const [bidding, setBidding] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const { 
    auctions, 
    loading, 
    fetchAuctions, 
    updateAuction, 
    addAuction, 
    updateRecentBidders 
  } = useAuctionData();

  // Sistema de filtros
  const { filters, setFilters, filteredAuctions, totalResults } = useAuctionFilters(auctions);

  // Hook para verificar e ativar leilões automaticamente
  useAuctionTimer(fetchAuctions);

  // Detectar quando usuário volta à aba para forçar sincronização
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(() => {
          fetchAuctions();
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAuctions]);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onBuyBids={handleBuyBids} />
      
      <AuctionFilters 
        filters={filters}
        onFiltersChange={setFilters}
        totalResults={totalResults}
      />
      
      <main className="py-8 flex-1">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Leilões Ativos
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Participe dos leilões mais quentes do momento! Cada segundo conta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              filteredAuctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  id={auction.id}
                  title={auction.title}
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
                  auctionStatus={auction.auctionStatus as 'waiting' | 'active' | 'finished'}
                  ends_at={auction.ends_at}
                  starts_at={auction.starts_at}
                  finished_at={(auction as any).finished_at}
                  winnerId={auction.winnerId}
                  winnerName={auction.winnerName}
                />
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Auctions;
