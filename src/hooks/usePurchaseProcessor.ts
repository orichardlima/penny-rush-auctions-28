import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PurchaseResult {
  success: boolean;
  error?: string;
  purchaseId?: string;
}

export const usePurchaseProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const processPurchase = async (
    packageId: string, 
    bidsCount: number, 
    price: number
  ): Promise<PurchaseResult> => {
    if (!profile?.user_id) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    setProcessing(true);

    try {
      // 1. Verificar se o pacote existe e tem o preço correto
      const { data: packageData, error: packageError } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (packageError || !packageData) {
        throw new Error('Pacote não encontrado');
      }

      if (packageData.price !== price || packageData.bids_count !== bidsCount) {
        throw new Error('Dados do pacote não conferem. Recarregue a página e tente novamente.');
      }

      // 2. Criar registro de compra
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('bid_purchases')
        .insert([
          {
            user_id: profile.user_id,
            package_id: packageId,
            bids_purchased: bidsCount,
            amount_paid: price,
            payment_status: 'completed' // Por enquanto, marcar como concluído diretamente
          }
        ])
        .select()
        .single();

      if (purchaseError) {
        throw new Error('Erro ao registrar compra');
      }

      // 3. Atualizar saldo de lances do usuário
      const newBalance = (profile.bids_balance || 0) + bidsCount;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', profile.user_id);

      if (updateError) {
        throw new Error('Erro ao atualizar saldo de lances');
      }

      // 4. Mostrar notificação de sucesso
      toast({
        title: "Compra realizada com sucesso! 🎉",
        description: `${bidsCount} lances foram adicionados à sua conta.`,
        variant: "default"
      });

      return { 
        success: true, 
        purchaseId: purchaseData.id 
      };

    } catch (error) {
      console.error('Error processing purchase:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erro interno do servidor';

      toast({
        title: "Erro na compra",
        description: errorMessage,
        variant: "destructive"
      });

      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setProcessing(false);
    }
  };

  return {
    processPurchase,
    processing
  };
};