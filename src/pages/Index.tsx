import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { AuctionCard } from "@/components/AuctionCard";
import { BidPackages } from "@/components/BidPackages";
import { HowItWorks } from "@/components/HowItWorks";
import { RecentWinners } from "@/components/RecentWinners";
import { useToast } from "@/hooks/use-toast";
import { useAuctionTimer } from "@/hooks/useAuctionTimer";
import { useRealTimeProtection } from "@/hooks/useRealTimeProtection";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toZonedTime, format } from 'date-fns-tz';
import { usePurchaseProcessor } from "@/hooks/usePurchaseProcessor";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayParticipants, formatUserNameForDisplay } from "@/lib/utils";
const Index = () => {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [bidding, setBidding] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const {
    toast
  } = useToast();
  const {
    processPurchase
  } = usePurchaseProcessor();
  const {
    profile,
    refreshProfile
  } = useAuth();
  const navigate = useNavigate();

  // Função para buscar dados completos do ganhador
  const fetchWinnerProfile = async (winnerId: string) => {
    try {
      const {
        data: profile
      } = await supabase.from('profiles').select('full_name, city, state').eq('user_id', winnerId).single();
      if (profile && profile.full_name) {
        const region = profile.city && profile.state ? `${profile.city}, ${profile.state}` : '';
        return region ? `${formatUserNameForDisplay(profile.full_name)} - ${region}` : formatUserNameForDisplay(profile.full_name);
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar perfil do ganhador:', error);
      return null;
    }
  };
  const transformAuctionData = async (auction: any) => {
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

    // Buscar nome completo do ganhador com região se finalizado
    let winnerNameWithRegion = auction.winner_name;
    if (auctionStatus === 'finished' && auction.winner_id) {
      const fullWinnerName = await fetchWinnerProfile(auction.winner_id);
      if (fullWinnerName) {
        winnerNameWithRegion = fullWinnerName;
      }
    }
    return {
      ...auction,
      image: auction.image_url || '/placeholder.svg',
      description: auction.description,
      currentPrice: auction.current_price || 1.00,
      originalPrice: auction.market_value || 0,
      // Already in reais
      totalBids: auction.total_bids || 0,
      participants: auction.participants_count || 0,
      recentBidders: auction.recentBidders || [],
      // Usar dados reais dos lances
      currentRevenue: (auction.total_bids || 0) * 1.00,
      timeLeft: endsAt ? Math.max(0, Math.floor((endsAt.getTime() - nowInBrazil.getTime()) / 1000)) : 0,
      auctionStatus,
      isActive: auctionStatus === 'active',
      ends_at: auction.ends_at,
      starts_at: auction.starts_at,
      finished_at: auction.finished_at,
      winnerId: auction.winner_id,
      winnerName: winnerNameWithRegion
    };
  };

  // Função para buscar lances recentes de um leilão
  const fetchRecentBidders = async (auctionId: string) => {
    try {
      // Buscar os últimos lances do leilão
      const {
        data: bids,
        error: bidsError
      } = await supabase.from('bids').select('user_id, created_at').eq('auction_id', auctionId).order('created_at', {
        ascending: false
      }).limit(5);
      if (bidsError) {
        console.error('Erro ao buscar lances recentes:', bidsError);
        return [];
      }
      if (!bids || bids.length === 0) {
        return [];
      }

      // Buscar os nomes dos usuários
      const userIds = bids.map(bid => bid.user_id);
      const {
        data: profiles
      } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);

      // Criar um mapa de user_id para nome
      const userNameMap = new Map();
      profiles?.forEach(profile => {
        userNameMap.set(profile.user_id, formatUserNameForDisplay(profile.full_name || ''));
      });

      // Retornar os nomes dos lances recentes
      return bids.map(bid => userNameMap.get(bid.user_id) || 'Usuário');
    } catch (error) {
      console.error('Erro ao buscar lances recentes:', error);
      return [];
    }
  };
  const fetchAuctions = useCallback(async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('auctions').select('*').or(`status.in.(active,waiting),and(status.eq.finished,updated_at.gte.${new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()})`).order('created_at', {
        ascending: false
      });
      if (error) {
        console.error('Error fetching auctions:', error);
        toast({
          title: "Erro ao carregar leilões",
          description: "Não foi possível carregar os leilões ativos.",
          variant: "destructive"
        });
        return;
      }

      // Para cada leilão, buscar os lances recentes e dados do ganhador
      const auctionsWithBidders = await Promise.all((data || []).map(async auction => {
        const recentBidders = await fetchRecentBidders(auction.id);
        return await transformAuctionData({
          ...auction,
          recentBidders
        });
      }));
      setAuctions(auctionsWithBidders);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Hook para verificar e ativar leilões automaticamente
  useAuctionTimer(fetchAuctions);

  // Sistema de proteção em tempo real (1 segundo)
  useRealTimeProtection();
  useEffect(() => {
    fetchAuctions();

    // Configurar realtime updates para leilões e lances
    const channel = supabase.channel('auctions-updates').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'auctions'
    }, async payload => {
      console.log('🔄 Atualização de leilão recebida:', payload);
      // Buscar lances recentes atualizados
      const recentBidders = await fetchRecentBidders(payload.new.id);
      const updatedAuction = await transformAuctionData({
        ...payload.new,
        recentBidders
      });
      setAuctions(prev => prev.map(auction => auction.id === updatedAuction.id ? updatedAuction : auction));
    }).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'auctions'
    }, async payload => {
      console.log('✨ Novo leilão criado:', payload);
      // Buscar lances recentes para o novo leilão
      const recentBidders = await fetchRecentBidders(payload.new.id);
      const newAuction = await transformAuctionData({
        ...payload.new,
        recentBidders
      });

      // Adicionar o novo leilão à lista se estiver ativo ou aguardando
      if (newAuction.status === 'active' || newAuction.status === 'waiting') {
        setAuctions(prev => [newAuction, ...prev]);
        toast({
          title: "Novo leilão disponível!",
          description: `${newAuction.title} foi adicionado aos leilões ativos.`
        });
      }
    })
    // NOVO: Listener para lances em tempo real
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'bids'
    }, async payload => {
      console.log('🎯 Novo lance recebido:', payload);
      const auctionId = payload.new.auction_id;

      // Buscar lances recentes atualizados para este leilão
      const recentBidders = await fetchRecentBidders(auctionId);

      // Atualizar apenas o leilão específico com os novos lances recentes
      setAuctions(prev => prev.map(auction => auction.id === auctionId ? {
        ...auction,
        recentBidders
      } : auction));
    }).subscribe(status => {
      console.log('📡 Status da conexão realtime:', status);
      if (status === 'CLOSED') {
        console.warn('⚠️ Conexão realtime perdida, tentando reconectar...');
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);
  const handleBid = async (auctionId: string) => {
    console.log('🎯 [LANCE] Iniciando lance para leilão:', auctionId);

    // Verificar se já está processando um lance para este leilão
    if (bidding.has(auctionId)) {
      console.log('🚫 [LANCE] Lance já sendo processado para:', auctionId);
      toast({
        title: "Aguarde!",
        description: "Já estamos processando um lance seu. Aguarde alguns segundos.",
        variant: "destructive"
      });
      return;
    }

    // Verificar se o usuário está autenticado
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    console.log('👤 [LANCE] Usuário:', user ? user.id : 'não logado');
    console.log('📊 [LANCE] Profile:', profile ? `${profile.full_name} - Saldo: ${profile.bids_balance}` : 'não carregado');
    if (!user || !profile) {
      console.log('❌ [LANCE] Usuário não autenticado ou perfil não carregado');
      toast({
        title: "Faça login para dar lances",
        description: "Você precisa estar logado para participar dos leilões.",
        variant: "destructive"
      });
      return;
    }

    // Verificar saldo de lances do usuário
    const currentBalance = profile.bids_balance || 0;
    console.log('💰 [LANCE] Saldo atual:', currentBalance);
    if (currentBalance < 1) {
      console.log('❌ [LANCE] Saldo insuficiente:', currentBalance);
      toast({
        title: "Sem lances disponíveis!",
        description: "Compre mais lances para continuar participando dos leilões.",
        variant: "destructive"
      });
      return;
    }

    // Marcar como processando
    setBidding(prev => new Set(prev).add(auctionId));
    console.log('⏳ [LANCE] Marcado como processando');
    try {
      console.log('🎯 [LANCE] Iniciando transação para leilão:', auctionId);

      // 1. Descontar R$ 1,00 do saldo do usuário
      const newBalance = currentBalance - 1;
      console.log('💸 [LANCE] Descontando do saldo:', currentBalance, '->', newBalance);
      const {
        error: balanceError
      } = await supabase.from('profiles').update({
        bids_balance: newBalance
      }).eq('user_id', user.id);
      if (balanceError) {
        console.error('❌ [LANCE] Erro ao descontar saldo:', balanceError);
        toast({
          title: "Erro ao processar lance",
          description: `Erro no saldo: ${balanceError.message}`,
          variant: "destructive"
        });
        return;
      }
      console.log('✅ [LANCE] Saldo descontado com sucesso');

      // 2. Inserir o lance no banco de dados
      console.log('📝 [LANCE] Inserindo lance no banco...');
      const {
        error: bidError
      } = await supabase.from('bids').insert({
        auction_id: auctionId,
        user_id: user.id,
        bid_amount: 1,
        // 1 centavo
        cost_paid: 1.00 // Custo do lance em reais (R$ 1,00)
      });
      if (bidError) {
        console.error('❌ [LANCE] Erro ao registrar lance:', bidError);

        // Reverter o desconto do saldo em caso de erro
        console.log('🔄 [LANCE] Revertendo desconto do saldo...');
        await supabase.from('profiles').update({
          bids_balance: currentBalance
        }).eq('user_id', user.id);
        toast({
          title: "Erro ao dar lance",
          description: `Erro no banco: ${bidError.message}`,
          variant: "destructive"
        });
        return;
      }
      console.log('✅ [LANCE] Lance registrado com sucesso no banco');

      // 3. Atualizar o perfil do usuário no contexto
      console.log('🔄 [LANCE] Atualizando perfil do usuário...');
      await refreshProfile();
      console.log('🎉 [LANCE] Processo completo com sucesso!');
    } catch (error) {
      console.error('❌ [LANCE] Erro geral:', error);
      toast({
        title: "Erro ao dar lance",
        description: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      // Remover da lista de processamento após 2 segundos para evitar problemas
      setTimeout(() => {
        setBidding(prev => {
          const newSet = new Set(prev);
          newSet.delete(auctionId);
          console.log('✅ [LANCE] Removido da lista de processamento:', auctionId);
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
  return <div className="min-h-screen bg-background">
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
              {loading ? <div className="col-span-full text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-4 text-muted-foreground">Carregando leilões...</p>
                </div> : auctions.length === 0 ? <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">Nenhum leilão disponível no momento.</p>
                </div> : auctions.sort((a, b) => {
              // Ordenar: ativos, em espera, finalizados
              const statusOrder = {
                active: 1,
                waiting: 2,
                finished: 3
              };
              if (statusOrder[a.auctionStatus] !== statusOrder[b.auctionStatus]) {
                return statusOrder[a.auctionStatus] - statusOrder[b.auctionStatus];
              }
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }).map(auction => <AuctionCard key={auction.id} id={auction.id} title={auction.title} description={auction.description} image={auction.image} currentPrice={auction.currentPrice} originalPrice={auction.originalPrice} totalBids={auction.totalBids} participants={getDisplayParticipants(auction.totalBids, auction.participants, profile?.is_admin)} userBids={profile?.bids_balance || 0} onBid={handleBid} recentBidders={auction.recentBidders} currentRevenue={auction.currentRevenue} timeLeft={auction.timeLeft} isActive={auction.isActive} auctionStatus={auction.auctionStatus} ends_at={auction.ends_at} starts_at={auction.starts_at} finished_at={(auction as any).finished_at} winnerId={auction.winnerId} winnerName={auction.winnerName} />)}
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
          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-sm opacity-75">© 2025 Show de Lances. Todos os direitos reservados.</div>
        </div>
      </footer>
    </div>;
};
export default Index;