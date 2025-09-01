import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { AuctionCard } from "@/components/AuctionCard";
import { useToast } from "@/hooks/use-toast";
import { useAuctionTimer } from "@/hooks/useAuctionTimer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toZonedTime } from 'date-fns-tz';

const Auctions = () => {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [bidding, setBidding] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();

  const transformAuctionData = (auction: any) => {
    const brazilTimezone = 'America/Sao_Paulo';
    const now = new Date();
    const nowInBrazil = toZonedTime(now, brazilTimezone);
    
    const startsAt = auction.starts_at ? toZonedTime(new Date(auction.starts_at), brazilTimezone) : null;
    const endsAt = auction.ends_at ? toZonedTime(new Date(auction.ends_at), brazilTimezone) : null;
    
    // Determinar o status real do leilão usando o fuso do Brasil
    let auctionStatus = 'waiting';
    if (startsAt && startsAt > nowInBrazil) {
      auctionStatus = 'waiting'; // Ainda não começou
    } else if (auction.status === 'active' && (!endsAt || endsAt > nowInBrazil)) {
      auctionStatus = 'active'; // Ativo
    } else {
      auctionStatus = 'finished'; // Finalizado
    }
    
    return {
      ...auction,
      image: auction.image_url || '/placeholder.svg',
      currentPrice: (auction.current_price || 10) / 100,
      originalPrice: auction.market_value || 0,
      totalBids: auction.total_bids || 0,
      participants: auction.participants_count || 0,
      recentBidders: auction.recentBidders || [],
      currentRevenue: (auction.total_bids || 0) * 1.00,
      timeLeft: endsAt ? Math.max(0, Math.floor((endsAt.getTime() - nowInBrazil.getTime()) / 1000)) : 0,
      auctionStatus,
      isActive: auctionStatus === 'active',
      ends_at: auction.ends_at,
      starts_at: auction.starts_at,
      winnerId: auction.winner_id,
      winnerName: auction.winner_name
    };
  };

  // Função para buscar lances recentes de um leilão
  const fetchRecentBidders = async (auctionId: string) => {
    try {
      // Buscar os últimos lances do leilão
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('user_id, created_at')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (bidsError) {
        console.error('Erro ao buscar lances recentes:', bidsError);
        return [];
      }

      if (!bids || bids.length === 0) {
        return [];
      }

      // Buscar os nomes dos usuários
      const userIds = bids.map(bid => bid.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      // Criar um mapa de user_id para nome
      const userNameMap = new Map();
      profiles?.forEach(profile => {
        userNameMap.set(profile.user_id, profile.full_name || 'Usuário');
      });

      // Retornar os nomes dos lances recentes
      return bids.map(bid => 
        userNameMap.get(bid.user_id) || 'Usuário'
      );
    } catch (error) {
      console.error('Erro ao buscar lances recentes:', error);
      return [];
    }
  };

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
  }, [toast]);

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
  }, [toast]);

  const handleBid = async (auctionId: string) => {
    // Verificar se já está processando um lance para este leilão
    if (bidding.has(auctionId)) {
      console.log('🚫 Lance já sendo processado para:', auctionId);
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
      console.log('🎯 Enviando lance para leilão:', auctionId);

      // 1. Descontar R$ 1,00 do saldo do usuário
      const newBalance = currentBalance - 1;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', user.id);

      if (balanceError) {
        console.error('❌ Erro ao descontar saldo:', balanceError);
        toast({
          title: "Erro ao processar lance",
          description: "Não foi possível descontar o valor do lance. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      // 2. Inserir o lance no banco de dados
      const { error: bidError } = await supabase
        .from('bids')
        .insert({
          auction_id: auctionId,
          user_id: user.id,
          bid_amount: 1, // 1 centavo
          cost_paid: 1.00 // Custo do lance em reais (R$ 1,00)
        });

      if (bidError) {
        console.error('❌ Erro ao registrar lance:', bidError);
        
        // Reverter o desconto do saldo em caso de erro
        await supabase
          .from('profiles')
          .update({ bids_balance: currentBalance })
          .eq('user_id', user.id);

        toast({
          title: "Erro ao dar lance",
          description: "Não foi possível registrar seu lance. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Lance registrado com sucesso');
      
      // 3. Atualizar o perfil do usuário no contexto
      await refreshProfile();
      
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

  return (
    <div className="min-h-screen bg-background">
      <Header onBuyBids={handleBuyBids} />
      
      <main className="py-16">
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
                  userBids={profile?.bids_balance || 0}
                  onBid={handleBid}
                  recentBidders={auction.recentBidders}
                  currentRevenue={auction.currentRevenue}
                  timeLeft={auction.timeLeft}
                  isActive={auction.isActive}
                  auctionStatus={auction.auctionStatus}
                  ends_at={auction.ends_at}
                  starts_at={auction.starts_at}
                  winnerId={auction.winnerId}
                  winnerName={auction.winnerName}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auctions;