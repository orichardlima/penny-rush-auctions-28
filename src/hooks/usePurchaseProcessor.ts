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
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const processPurchase = async (
    packageId: string, 
    bidsCount: number, 
    price: number,
    packageName: string
  ): Promise<PurchaseResult> => {
    if (!profile?.user_id) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    setProcessing(true);

    try {
      // Criar preferência no Mercado Pago
      const { data, error } = await supabase.functions.invoke('mercado-pago-payment', {
        body: {
          action: 'create_preference',
          packageId,
          bidsCount,
          price,
          packageName
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao processar pagamento');
      }

      // Redirecionar para checkout do Mercado Pago
      window.open(data.init_point, '_blank');

      toast({
        title: "Redirecionando para pagamento",
        description: "Você será redirecionado para completar o pagamento no Mercado Pago.",
        variant: "default"
      });

      return { 
        success: true, 
        purchaseId: data.preference_id 
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