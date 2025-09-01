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
    const url = new URL(req.url);
    let data: any = {};
    
    // Handle webhook via query params (Mercado Pago can send this way)
    if (url.searchParams.get('action') === 'webhook') {
      const id = url.searchParams.get('id') || url.searchParams.get('data.id');
      const topic = url.searchParams.get('topic') || url.searchParams.get('type');
      
      if (!id || !topic) {
        console.log('🚨 Webhook inválido - missing id or topic:', { id, topic });
        return new Response("Missing id or topic", { headers: corsHeaders, status: 400 });
      }
      
      data = { action: 'webhook', id, topic };
    } else {
      const requestData = await req.json();
      data = requestData;
    }

    const { action } = data;

    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoAccessToken) {
      throw new Error("Mercado Pago access token não configurado");
    }

    // Webhook não precisa de autenticação (é chamado pelo Mercado Pago)
    if (action === "webhook") {
      // Processar webhook do Mercado Pago
      const { id, topic } = data;

      console.log(`📨 Webhook recebido - Topic: ${topic}, ID: ${id}`);

      if (topic === "payment") {
        // Buscar informações do pagamento
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
          headers: {
            "Authorization": `Bearer ${mercadoPagoAccessToken}`
          }
        });

        if (!paymentResponse.ok) {
          console.error(`❌ Erro ao buscar pagamento ${id}:`, await paymentResponse.text());
          throw new Error("Erro ao buscar informações do pagamento");
        }

        const paymentData = await paymentResponse.json();
        const externalReference = paymentData.external_reference;

        console.log(`💳 Dados do pagamento:`, { 
          id: paymentData.id, 
          status: paymentData.status, 
          external_reference: externalReference 
        });

        if (!externalReference) {
          console.error("❌ Referência externa não encontrada no pagamento");
          throw new Error("Referência externa não encontrada");
        }

        // Buscar a compra no banco
        const { data: purchaseData, error: purchaseError } = await supabaseService
          .from('bid_purchases')
          .select('*')
          .eq('external_reference', externalReference)
          .single();

        if (purchaseError || !purchaseData) {
          console.error("❌ Compra não encontrada:", externalReference, purchaseError);
          throw new Error("Compra não encontrada");
        }

        // Atualizar status do pagamento
        let newStatus = 'pending';
        if (paymentData.status === 'approved') {
          newStatus = 'completed';
        } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
          newStatus = 'failed';
        }

        console.log(`🔄 Atualizando status de ${purchaseData.payment_status} para ${newStatus}`);

        const { error: updateError } = await supabaseService
          .from('bid_purchases')
          .update({ payment_status: newStatus })
          .eq('id', purchaseData.id);

        if (updateError) {
          console.error("❌ Erro ao atualizar compra:", updateError);
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
            console.error("❌ Erro ao atualizar saldo:", balanceError);
            throw new Error("Erro ao atualizar saldo");
          }

          console.log(`✅ Saldo atualizado: ${currentBalance} → ${newBalance} (usuário ${purchaseData.user_id})`);
        }
      }

      return new Response("OK", {
        headers: corsHeaders,
        status: 200,
      });
    }

    // Para outras ações, verificar autenticação
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

      console.log(`🔄 Processando pagamento PIX: ${externalReference}`);

      // Criar pagamento PIX real na API do Mercado Pago
      if (paymentData.payment_method_id === 'pix') {
        const paymentPayload = {
          transaction_amount: price,
          payment_method_id: 'pix',
          payer: {
            email: user.email || `user${user.id}@leilaocentavos.com`,
            first_name: 'Cliente',
            last_name: 'LeilãoCentavos',
            identification: {
              type: 'CPF',
              number: '12345678901' // Em produção, solicitar CPF real do usuário
            }
          },
          description: `${packageName} - ${bidsCount} Lances`,
          external_reference: externalReference,
          notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercado-pago-payment?action=webhook`,
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
        };

        console.log(`📡 Enviando requisição para Mercado Pago:`, paymentPayload);

        const response = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${mercadoPagoAccessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": externalReference
          },
          body: JSON.stringify(paymentPayload)
        });

        const responseText = await response.text();
        console.log(`📨 Resposta Mercado Pago (${response.status}):`, responseText);

        if (!response.ok) {
          console.error("❌ Erro na API do Mercado Pago:", responseText);
          throw new Error(`Erro na API do Mercado Pago: ${response.status} - ${responseText}`);
        }

        const paymentResponse = JSON.parse(responseText);
        console.log(`✅ Pagamento criado:`, paymentResponse);

        // Criar registro de compra
        const { error: purchaseError } = await supabaseService
          .from('bid_purchases')
          .insert([
            {
              user_id: user.id,
              package_id: packageId,
              bids_purchased: bidsCount,
              amount_paid: price,
              payment_status: 'pending',
              external_reference: externalReference,
              payment_id: paymentResponse.id?.toString()
            }
          ]);

        if (purchaseError) {
          console.error("❌ Erro ao criar registro de compra:", purchaseError);
          throw new Error('Erro ao registrar compra');
        }

        // Retornar dados do pagamento PIX real
        const result = {
          status: paymentResponse.status,
          payment_id: paymentResponse.id,
          qr_code: paymentResponse.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64: paymentResponse.point_of_interaction?.transaction_data?.qr_code_base64,
          ticket_url: paymentResponse.point_of_interaction?.transaction_data?.ticket_url,
          external_reference: externalReference,
          date_of_expiration: paymentResponse.date_of_expiration
        };

        console.log(`📋 Resultado PIX:`, result);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Para outros métodos de pagamento (cartão, etc.)
      throw new Error("Método de pagamento não suportado");
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