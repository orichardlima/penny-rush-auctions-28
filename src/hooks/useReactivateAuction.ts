import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useReactivateAuction = () => {
  const [isReactivating, setIsReactivating] = useState(false);
  const { toast } = useToast();

  const reactivateAuction = async (auctionId: string) => {
    setIsReactivating(true);
    
    try {
      // Primeiro verificar se o usuário é admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.is_admin) {
        toast({
          title: "Erro",
          description: "Apenas administradores podem reativar leilões.",
          variant: "destructive"
        });
        return false;
      }

      console.log('Tentando reativar leilão:', auctionId);
      
      // Reativar o leilão removendo dados de finalização
      const { data, error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          winner_id: null,
          winner_name: null,
          finished_at: null,
          time_left: 15 // Reiniciar timer com 15 segundos
        })
        .eq('id', auctionId)
        .eq('status', 'finished') // Só reativa se estiver finalizado
        .select();

      if (updateError) {
        console.error('Erro ao reativar leilão:', updateError);
        toast({
          title: "Erro",
          description: `Não foi possível reativar o leilão: ${updateError.message}`,
          variant: "destructive"
        });
        return false;
      }

      if (!data || data.length === 0) {
        toast({
          title: "Erro",
          description: "Leilão não encontrado ou já está ativo.",
          variant: "destructive"
        });
        return false;
      }

      console.log('Leilão reativado com sucesso:', data);

      toast({
        title: "Sucesso",
        description: "Leilão reativado com sucesso! O timer foi reiniciado.",
      });

      // Recarregar a página para atualizar os dados
      setTimeout(() => {
        window.location.reload();
      }, 1000);

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