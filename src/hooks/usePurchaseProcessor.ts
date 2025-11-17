import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getReferralCode } from '@/hooks/useReferralTracking';

interface PurchaseResult {
  success: boolean;
  error?: string;
  purchaseId?: string;
  paymentData?: {
    paymentId: string;
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopyPaste?: string;
  };
}

export const usePurchaseProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const { profile, refreshProfile } = useAuth();
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

      // 2. Capturar código de referral se existir
      const referralCode = getReferralCode();

      // 3. Criar pagamento via Mercado Pago
      const { data: paymentResponse, error: paymentError } = await supabase.functions.invoke('mercado-pago-payment', {
        body: {
          packageId,
          userId: profile.user_id,
          userEmail: profile.email,
          userName: profile.full_name,
          referralCode: referralCode || undefined
        }
      });

      if (paymentError || !paymentResponse) {
        throw new Error(paymentResponse?.error || 'Erro ao gerar pagamento PIX');
      }

      toast({
        title: "PIX gerado com sucesso! 💳",
        description: "Escaneie o QR Code ou copie o código PIX para pagar.",
        variant: "default"
      });

      return { 
        success: true, 
        purchaseId: paymentResponse.purchaseId,
        paymentData: {
          paymentId: paymentResponse.paymentId,
          qrCode: paymentResponse.qrCode,
          qrCodeBase64: paymentResponse.qrCodeBase64,
          pixCopyPaste: paymentResponse.pixCopyPaste
        }
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