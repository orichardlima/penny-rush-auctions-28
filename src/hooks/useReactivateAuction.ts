import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useReactivateAuction = () => {
  const [isReactivating, setIsReactivating] = useState(false);
  const { toast } = useToast();

  const reactivateAuction = async (auctionId: string) => {
    setIsReactivating(true);
    
    try {
      // Reativar o leilão removendo dados de finalização
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          winner_id: null,
          winner_name: null,
          finished_at: null,
          time_left: 15 // Reiniciar timer com 15 segundos
        })
        .eq('id', auctionId)
        .eq('status', 'finished'); // Só reativa se estiver finalizado

      if (updateError) {
        console.error('Erro ao reativar leilão:', updateError);
        toast({
          title: "Erro",
          description: "Não foi possível reativar o leilão. Verifique se você tem permissões de administrador.",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: "Leilão reativado com sucesso! O timer foi reiniciado.",
      });

      return true;
    } catch (error) {
      console.error('Erro ao reativar leilão:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao reativar leilão",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsReactivating(false);
    }
  };

  return {
    reactivateAuction,
    isReactivating
  };
};