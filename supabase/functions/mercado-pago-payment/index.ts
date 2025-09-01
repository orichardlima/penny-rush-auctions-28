import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase client using the anon key for user authentication
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  // Create Supabase service client for database operations
  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { action, ...data } = await req.json();

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Usuário não autenticado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoAccessToken) {
      throw new Error("Mercado Pago access token não configurado");
    }

    if (action === "process_payment") {
      const { packageId, bidsCount, price, packageName, paymentData } = data;

      // Verificar se o pacote existe
      const { data: packageData, error: packageError } = await supabaseService
        .from('bid_packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (packageError || !packageData) {
        throw new Error('Pacote não encontrado');
      }

      if (packageData.price !== price || packageData.bids_count !== bidsCount) {
        throw new Error('Dados do pacote não conferem');
      }

      const externalReference = `${user.id}_${packageId}_${Date.now()}`;

      // Criar estrutura de pagamento
      const payment = {
        transaction_amount: price,
        payment_method_id: paymentData.payment_method_id,
        payer: {
          email: paymentData.email || user.email
        },
        external_reference: externalReference
      };

      // Adicionar dados específicos dependendo do método
      if (paymentData.payment_method_id === 'pix') {
        // Para PIX
      } else {
        // Para cartão
        payment.token = await createCardToken(paymentData);
        payment.payer.identification = {
          type: paymentData.doc_type,
          number: paymentData.doc_number.replace(/\D/g, '')
        };
      }

      // Processar pagamento no Mercado Pago
      const response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mercadoPagoAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payment)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Mercado Pago payment error:", errorData);
        throw new Error("Erro ao processar pagamento no Mercado Pago");
      }

      const paymentResult = await response.json();
      console.log("Payment result:", paymentResult);

      // Criar registro de compra
      const { error: purchaseError } = await supabaseService
        .from('bid_purchases')
        .insert([
          {
            user_id: user.id,
            package_id: packageId,
            bids_purchased: bidsCount,
            amount_paid: price,
            payment_status: paymentResult.status === 'approved' ? 'completed' : paymentResult.status,
            external_reference: externalReference
          }
        ]);

      if (purchaseError) {
        console.error("Error creating purchase record:", purchaseError);
        throw new Error('Erro ao registrar compra');
      }

      // Se pagamento aprovado, atualizar saldo do usuário
      if (paymentResult.status === 'approved') {
        const { data: profileData } = await supabaseService
          .from('profiles')
          .select('bids_balance')
          .eq('user_id', user.id)
          .single();

        const currentBalance = profileData?.bids_balance || 0;
        const newBalance = currentBalance + bidsCount;

        await supabaseService
          .from('profiles')
          .update({ bids_balance: newBalance })
          .eq('user_id', user.id);
      }

      // Retornar resultado
      const result: any = {
        status: paymentResult.status,
        payment_id: paymentResult.id
      };

      // Para PIX, retornar QR code
      if (paymentData.payment_method_id === 'pix' && paymentResult.point_of_interaction?.transaction_data) {
        result.qr_code = paymentResult.point_of_interaction.transaction_data.qr_code;
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "create_preference") {
      const { packageId, bidsCount, price, packageName } = data;

      // Verificar se o pacote existe
      const { data: packageData, error: packageError } = await supabaseService
        .from('bid_packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (packageError || !packageData) {
        throw new Error('Pacote não encontrado');
      }

      if (packageData.price !== price || packageData.bids_count !== bidsCount) {
        throw new Error('Dados do pacote não conferem');
      }

      // Criar preferência no Mercado Pago
      const preference = {
        items: [
          {
            title: `${packageName} - ${bidsCount} Lances`,
            unit_price: price,
            quantity: 1,
            currency_id: "BRL"
          }
        ],
        payer: {
          email: user.email
        },
        external_reference: `${user.id}_${packageId}_${Date.now()}`,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercado-pago-payment`,
        back_urls: {
          success: `${req.headers.get("origin")}/dashboard?payment=success`,
          failure: `${req.headers.get("origin")}/dashboard?payment=failure`,
          pending: `${req.headers.get("origin")}/dashboard?payment=pending`
        },
        auto_return: "approved"
      };

      const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mercadoPagoAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(preference)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Mercado Pago error:", errorData);
        throw new Error("Erro ao criar preferência no Mercado Pago");
      }

      const preferenceData = await response.json();

      // Criar registro de compra pendente
      const { error: purchaseError } = await supabaseService
        .from('bid_purchases')
        .insert([
          {
            user_id: user.id,
            package_id: packageId,
            bids_purchased: bidsCount,
            amount_paid: price,
            payment_status: 'pending',
            external_reference: preference.external_reference
          }
        ]);

      if (purchaseError) {
        console.error("Error creating purchase record:", purchaseError);
        throw new Error('Erro ao registrar compra');
      }

      return new Response(JSON.stringify({ 
        preference_id: preferenceData.id,
        init_point: preferenceData.init_point,
        sandbox_init_point: preferenceData.sandbox_init_point
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "webhook") {
      // Processar webhook do Mercado Pago
      const { id, topic } = data;

      if (topic === "payment") {
        // Buscar informações do pagamento
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
          headers: {
            "Authorization": `Bearer ${mercadoPagoAccessToken}`
          }
        });

        if (!paymentResponse.ok) {
          throw new Error("Erro ao buscar informações do pagamento");
        }

        const paymentData = await paymentResponse.json();
        const externalReference = paymentData.external_reference;

        if (!externalReference) {
          throw new Error("Referência externa não encontrada");
        }

        // Buscar a compra no banco
        const { data: purchaseData, error: purchaseError } = await supabaseService
          .from('bid_purchases')
          .select('*')
          .eq('external_reference', externalReference)
          .single();

        if (purchaseError || !purchaseData) {
          console.error("Purchase not found:", externalReference);
          throw new Error("Compra não encontrada");
        }

        // Atualizar status do pagamento
        let newStatus = 'pending';
        if (paymentData.status === 'approved') {
          newStatus = 'completed';
        } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
          newStatus = 'failed';
        }

        const { error: updateError } = await supabaseService
          .from('bid_purchases')
          .update({ payment_status: newStatus })
          .eq('id', purchaseData.id);

        if (updateError) {
          console.error("Error updating purchase:", updateError);
          throw new Error("Erro ao atualizar status da compra");
        }

        // Se pagamento aprovado, atualizar saldo do usuário
        if (newStatus === 'completed') {
          const { data: profileData } = await supabaseService
            .from('profiles')
            .select('bids_balance')
            .eq('user_id', purchaseData.user_id)
            .single();

          const currentBalance = profileData?.bids_balance || 0;
          const newBalance = currentBalance + purchaseData.bids_purchased;

          const { error: balanceError } = await supabaseService
            .from('profiles')
            .update({ bids_balance: newBalance })
            .eq('user_id', purchaseData.user_id);

          if (balanceError) {
            console.error("Error updating balance:", balanceError);
            throw new Error("Erro ao atualizar saldo");
          }
        }
      }

      return new Response("OK", {
        headers: corsHeaders,
        status: 200,
      });
    }

    throw new Error("Ação não reconhecida");

  } catch (error) {
    console.error('Error processing Mercado Pago request:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Erro interno do servidor';

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function createCardToken(paymentData: any) {
  // Esta função seria usada para tokenizar dados do cartão
  // Por simplicidade, vamos retornar dados mockados
  // Em produção, você usaria o SDK do Mercado Pago para tokenizar
  return "mock_token_" + Date.now();
}