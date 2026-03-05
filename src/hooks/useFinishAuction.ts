import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatUserNameForDisplay } from '@/lib/utils';

export const useFinishAuction = () => {
  const [isFinishing, setIsFinishing] = useState(false);
  const { toast } = useToast();

  const finishAuction = async (auctionId: string) => {
    setIsFinishing(true);
    
    try {
      // 1. Buscar dados do leilão para verificar receita
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .select('company_revenue, revenue_target, current_price, bid_increment')
        .eq('id', auctionId)
        .eq('status', 'active')
        .single();

      if (auctionError || !auction) {
        toast({
          title: "Erro",
          description: "Leilão não encontrado ou não está ativo",
          variant: "destructive"
        });
        return false;
      }

      // 2. Buscar o último lance do leilão com info de bot
      const { data: lastBid, error: bidError } = await supabase
        .from('bids')
        .select('user_id, cost_paid')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (bidError || !lastBid) {
        toast({
          title: "Erro",
          description: "Não foi possível encontrar lances para este leilão",
          variant: "destructive"
        });
        return false;
      }

      let winnerId = lastBid.user_id;

      // 3. PROTEÇÃO: Se receita insuficiente e último lance é de usuário real, inserir bot
      if (auction.company_revenue < (auction.revenue_target || 0) && lastBid.cost_paid > 0) {
        // Último lance é de usuário real e receita não atingida — inserir bot
        const { data: botUser } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('is_bot', true)
          .limit(1)
          .single();

        if (botUser) {
          const newPrice = (auction.current_price || 0) + (auction.bid_increment || 0.01);
          await supabase
            .from('bids')
            .insert({
              auction_id: auctionId,
              user_id: botUser.user_id,
              bid_amount: newPrice,
              cost_paid: 0
            });
          
          winnerId = botUser.user_id;
        }
      }

      // 4. Buscar dados do perfil do vencedor
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, city, state')
        .eq('user_id', winnerId)
        .single();

      if (profileError || !profile) {
        toast({
          title: "Erro", 
          description: "Não foi possível encontrar dados do vencedor",
          variant: "destructive"
        });
        return false;
      }

      // 5. Formatar nome do vencedor com região
      const winnerName = profile.city && profile.state 
        ? `${formatUserNameForDisplay(profile.full_name)} - ${profile.city}, ${profile.state}`
        : formatUserNameForDisplay(profile.full_name);

      // 6. Finalizar o leilão
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          winner_id: winnerId,
          winner_name: winnerName,
          finished_at: new Date().toISOString()
        })
        .eq('id', auctionId)
        .eq('status', 'active');

      if (updateError) {
        console.error('Erro ao finalizar leilão:', updateError);
        toast({
          title: "Erro",
          description: "Não foi possível finalizar o leilão",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: `Leilão finalizado! Vencedor: ${winnerName}`,
      });

      return true;
    } catch (error) {
      console.error('Erro ao finalizar leilão:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao finalizar leilão",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsFinishing(false);
    }
  };

  return {
    finishAuction,
    isFinishing
  };
};
