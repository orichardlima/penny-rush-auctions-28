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