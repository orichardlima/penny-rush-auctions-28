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
      // 1. Buscar o último lance do leilão
      const { data: lastBid, error: bidError } = await supabase
        .from('bids')
        .select('user_id')
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

      // 2. Buscar dados do perfil do vencedor
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, city, state')
        .eq('user_id', lastBid.user_id)
        .single();

      if (profileError || !profile) {
        toast({
          title: "Erro", 
          description: "Não foi possível encontrar dados do vencedor",
          variant: "destructive"
        });
        return false;
      }

      // 3. Formatar nome do vencedor com região
      const winnerName = profile.city && profile.state 
        ? `${formatUserNameForDisplay(profile.full_name)} - ${profile.city}, ${profile.state}`
        : formatUserNameForDisplay(profile.full_name);

      // 4. Finalizar o leilão
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          winner_id: lastBid.user_id,
          winner_name: winnerName,
          finished_at: new Date().toISOString()
        })
        .eq('id', auctionId)
        .eq('status', 'active'); // Só finaliza se estiver ativo

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