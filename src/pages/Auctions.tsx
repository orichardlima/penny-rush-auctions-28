import { Header } from "@/components/Header";
import { AuctionCard } from "@/components/AuctionCard";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Import product images
import iphoneImage from "@/assets/iphone-15-pro.jpg";
import macbookImage from "@/assets/macbook-air-m2.jpg";
import samsungImage from "@/assets/samsung-s24.jpg";
import playstationImage from "@/assets/playstation-5.jpg";
import tvImage from "@/assets/smart-tv-55.jpg";
import watchImage from "@/assets/apple-watch-ultra.jpg";

const Auctions = () => {
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();

  const auctions = [
    {
      id: "1",
      title: "iPhone 15 Pro Max 256GB",
      image: iphoneImage,
      currentPrice: 23.45,
      originalPrice: 8999.00,
      totalBids: 2345,
      participants: 187,
      recentBidders: ["João S.", "Maria L.", "Pedro R.", "Ana C."]
    },
    {
      id: "2", 
      title: "MacBook Air M2 13'' 512GB",
      image: macbookImage,
      currentPrice: 156.78,
      originalPrice: 12999.00,
      totalBids: 15678,
      participants: 892,
      recentBidders: ["Carlos M.", "Julia K.", "Rafael T."]
    },
    {
      id: "3",
      title: "Samsung Galaxy S24 Ultra",
      image: samsungImage,
      currentPrice: 89.23,
      originalPrice: 7499.00,
      totalBids: 8923,
      participants: 456,
      recentBidders: ["Lucas P.", "Fernanda B.", "Diego A.", "Camila S.", "Bruno N."]
    },
    {
      id: "4",
      title: "PlayStation 5 + 2 Controles",
      image: playstationImage,
      currentPrice: 67.89,
      originalPrice: 4799.00,
      totalBids: 6789,
      participants: 324,
      recentBidders: ["Thiago L.", "Isabela F."]
    },
    {
      id: "5",
      title: "Smart TV 55'' 4K OLED",
      image: tvImage,
      currentPrice: 45.67,
      originalPrice: 3299.00,
      totalBids: 4567,
      participants: 234,
      recentBidders: ["Roberto C.", "Leticia M.", "Gustavo H."]
    },
    {
      id: "6", 
      title: "Apple Watch Ultra 2",
      image: watchImage,
      currentPrice: 123.45,
      originalPrice: 6999.00,
      totalBids: 12345,
      participants: 567,
      recentBidders: ["Patricia V.", "Eduardo S.", "Mariana O.", "Felipe G."]
    }
  ];

  const handleBid = async (auctionId: string) => {
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

    try {
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
            {auctions.map((auction) => (
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
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auctions;