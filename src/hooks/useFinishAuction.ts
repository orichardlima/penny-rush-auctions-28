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
      // 1. Verificar se leilão está ativo
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .select('current_price, bid_increment, last_bidders')
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

      // 2. REGRA ABSOLUTA: Vencedor é SEMPRE um bot - sem exceções
      // Buscar vencedores recentes (48h) para evitar repetição
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentWinners } = await supabase
        .from('auctions')
        .select('winner_id')
        .eq('status', 'finished')
        .not('winner_id', 'is', null)
        .gte('finished_at', cutoff);

      const excludeIds = (recentWinners || []).map(r => r.winner_id);

      const { data: allBots } = await supabase
        .from('profiles')
        .select('user_id, full_name, city, state')
        .eq('is_bot', true);

      if (!allBots || allBots.length === 0) {
        toast({
          title: "Erro",
          description: "Nenhum bot disponível para ser vencedor",
          variant: "destructive"
        });
        return false;
      }

      // Filtrar bots que não venceram recentemente, com fallback
      const availableBots = allBots.filter(b => !excludeIds.includes(b.user_id));
      const botPool = availableBots.length > 0 ? availableBots : allBots;
      const selectedBot = botPool[Math.floor(Math.random() * botPool.length)];

      // 3. Inserir lance final do bot
      const newPrice = (auction.current_price || 0) + (auction.bid_increment || 0.01);
      await supabase
        .from('bids')
        .insert({
          auction_id: auctionId,
          user_id: selectedBot.user_id,
          bid_amount: newPrice,
          cost_paid: 0
        });

      // 4. Formatar nome do vencedor com região
      const winnerName = selectedBot.city && selectedBot.state
        ? `${formatUserNameForDisplay(selectedBot.full_name)} - ${selectedBot.city}, ${selectedBot.state}`
        : formatUserNameForDisplay(selectedBot.full_name);

      // 5. Sincronizar last_bidders com bot vencedor
      const botDisplay = formatUserNameForDisplay(selectedBot.full_name);
      let currentBidders: string[] = Array.isArray(auction.last_bidders)
        ? (auction.last_bidders as string[]) : [];
      currentBidders = [botDisplay, ...currentBidders.filter(n => n !== botDisplay)].slice(0, 3);

      // 6. Finalizar o leilão com bot como vencedor
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          winner_id: selectedBot.user_id,
          winner_name: winnerName,
          finished_at: new Date().toISOString(),
          last_bidders: currentBidders
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
