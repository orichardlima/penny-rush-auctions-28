import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log(`🚀 [MERCADO-PAGO] ${req.method} ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log(`✅ [MERCADO-PAGO] CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase clients
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const url = new URL(req.url);
    let data: any = {};
    
    console.log(`🔍 [MERCADO-PAGO] URL: ${url.pathname}`);
    
    // Handle webhook via query params
    if (url.searchParams.get('action') === 'webhook') {
      const id = url.searchParams.get('id') || url.searchParams.get('data.id');
      const topic = url.searchParams.get('topic') || url.searchParams.get('type');
      
      if (!id || !topic) {
        console.log('🚨 Webhook inválido:', { id, topic });
        return new Response("Missing id or topic", { headers: corsHeaders, status: 400 });
      }
      
      data = { action: 'webhook', id, topic };
    } else {
      try {
        data = await req.json();
        console.log(`📨 [MERCADO-PAGO] Dados:`, data);
      } catch (error) {
        console.error(`❌ [MERCADO-PAGO] JSON inválido:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    const { action } = data;
    console.log(`🎯 [MERCADO-PAGO] Ação: ${action}`);

    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoAccessToken) {
      console.error(`❌ [MERCADO-PAGO] Token não configurado`);
      throw new Error("Mercado Pago access token não configurado");
    }

    // === WEBHOOK ===
    if (action === "webhook") {
      const { id, topic } = data;
      console.log(`📨 Webhook - Topic: ${topic}, ID: ${id}`);

      if (topic === "payment") {
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
          headers: { "Authorization": `Bearer ${mercadoPagoAccessToken}` }
        });

        if (!paymentResponse.ok) {
          console.error(`❌ Erro ao buscar pagamento ${id}`);
          throw new Error("Erro ao buscar informações do pagamento");
        }

        const paymentData = await paymentResponse.json();
        const externalReference = paymentData.external_reference;

        console.log(`💳 Pagamento:`, { id, status: paymentData.status, external_reference: externalReference });

        if (!externalReference) {
          throw new Error("Referência externa não encontrada");
        }

        // Buscar compra
        const { data: purchaseData, error: purchaseError } = await supabaseService
          .from('bid_purchases')
          .select('*')
          .eq('external_reference', externalReference)
          .maybeSingle();

        if (purchaseError || !purchaseData) {
          console.error("❌ Compra não encontrada:", externalReference);
          throw new Error("Compra não encontrada");
        }

        // Atualizar status
        let newStatus = 'pending';
        if (paymentData.status === 'approved') newStatus = 'completed';
        else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') newStatus = 'failed';

        console.log(`🔄 Status: ${purchaseData.payment_status} → ${newStatus}`);

        const { error: updateError } = await supabaseService
          .from('bid_purchases')
          .update({ payment_status: newStatus })
          .eq('id', purchaseData.id);

        if (updateError) {
          console.error("❌ Erro ao atualizar compra:", updateError);
          throw new Error("Erro ao atualizar status da compra");
        }

        // Se aprovado, atualizar saldo
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

          console.log(`✅ Saldo atualizado: ${currentBalance} → ${newBalance}`);
        }
      }

      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    // === PAGAMENTO ===
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error(`❌ [MERCADO-PAGO] Sem authorization header`);
      throw new Error("Usuário não autenticado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      console.error(`❌ [MERCADO-PAGO] Erro de auth:`, authError);
      throw new Error("Usuário não autenticado");
    }

    const user = userData.user;
    console.log(`👤 [MERCADO-PAGO] User: ${user.id}`);

    if (action === "process_payment") {
      const { packageId, bidsCount, price, packageName, paymentData } = data;

      console.log(`🔍 [MERCADO-PAGO] Verificando pacote: ${packageId}`);
      
      // Verificar pacote
      const { data: packageData, error: packageError } = await supabaseService
        .from('bid_packages')
        .select('*')
        .eq('id', packageId)
        .maybeSingle();

      if (packageError) {
        console.error(`❌ [MERCADO-PAGO] Erro busca pacote:`, packageError);
        throw new Error('Erro ao buscar pacote');
      }

      if (!packageData) {
        console.error(`❌ [MERCADO-PAGO] Pacote não encontrado: ${packageId}`);
        throw new Error('Pacote não encontrado');
      }

      console.log(`📦 [MERCADO-PAGO] Pacote: ${packageData.name}, Preço: ${packageData.price}, Lances: ${packageData.bids_count}`);

      if (packageData.price !== price || packageData.bids_count !== bidsCount) {
        console.error(`❌ [MERCADO-PAGO] Dados não conferem`);
        throw new Error('Dados do pacote não conferem');
      }

      const externalReference = `${user.id}_${packageId}_${Date.now()}`;
      console.log(`🔄 [MERCADO-PAGO] Processando PIX: ${externalReference}`);

      // Criar pagamento PIX
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
              number: '12345678901' // Em produção usar CPF real
            }
          },
          description: `${packageName} - ${bidsCount} Lances`,
          external_reference: externalReference,
          notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercado-pago-payment?action=webhook`,
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };

        console.log(`📡 [MERCADO-PAGO] Payload:`, paymentPayload);

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
        console.log(`📨 [MERCADO-PAGO] Response (${response.status}):`, responseText.substring(0, 200));

        if (!response.ok) {
          console.error("❌ [MERCADO-PAGO] API Error:", responseText);
          throw new Error(`Erro API Mercado Pago: ${response.status}`);
        }

        const paymentResponse = JSON.parse(responseText);
        console.log(`✅ [MERCADO-PAGO] Pagamento criado:`, paymentResponse.id);

        // Registrar compra
        const { error: purchaseError } = await supabaseService
          .from('bid_purchases')
          .insert([{
            user_id: user.id,
            package_id: packageId,
            bids_purchased: bidsCount,
            amount_paid: price,
            payment_status: 'pending',
            external_reference: externalReference,
            payment_id: paymentResponse.id?.toString()
          }]);

        if (purchaseError) {
          console.error("❌ [MERCADO-PAGO] Erro insert:", purchaseError);
          throw new Error('Erro ao registrar compra');
        }

        const result = {
          status: paymentResponse.status,
          payment_id: paymentResponse.id,
          qr_code: paymentResponse.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64: paymentResponse.point_of_interaction?.transaction_data?.qr_code_base64,
          external_reference: externalReference
        };

        console.log(`📋 [MERCADO-PAGO] Resultado:`, { ...result, qr_code: result.qr_code ? 'PRESENTE' : 'AUSENTE' });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      throw new Error("Método de pagamento não suportado");
    }

    throw new Error("Ação não reconhecida");

  } catch (error) {
    console.error('❌ [MERCADO-PAGO] ERRO:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : String(error)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});