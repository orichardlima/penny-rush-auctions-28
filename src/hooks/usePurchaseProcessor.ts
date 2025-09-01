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
      // Processar compra direto no modal - não fazemos nada aqui
      // O processamento será feito dentro do PaymentModal
      return { 
        success: true, 
        purchaseId: packageId 
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