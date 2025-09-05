import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { auction_id } = await req.json();

    if (!auction_id) {
      return new Response(
        JSON.stringify({ error: 'auction_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🛡️ [PROTECTION] Iniciando verificação para leilão ${auction_id}`);

    // Buscar dados do leilão
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auction_id)
      .single();

    if (auctionError || !auction) {
      console.error(`❌ [PROTECTION] Leilão não encontrado: ${auction_id}`);
      return new Response(
        JSON.stringify({ error: 'Leilão não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (auction.status !== 'active') {
      console.log(`⚠️ [PROTECTION] Leilão ${auction_id} não está ativo (status: ${auction.status})`);
      return new Response(
        JSON.stringify({ message: 'Leilão não está ativo', action: 'ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { company_revenue, revenue_target, title } = auction;

    console.log(`💰 [PROTECTION] Receita atual: R$${company_revenue} | Meta: R$${revenue_target}`);

    // Verificar se meta foi atingida
    if (company_revenue >= revenue_target) {
      // Meta atingida - finalizar leilão
      console.log(`🎯 [PROTECTION] Meta atingida! Finalizando leilão "${title}"`);

      // Buscar último bidder para definir como vencedor
      const { data: lastBid } = await supabase
        .from('bids')
        .select(`
          user_id,
          profiles!inner(full_name)
        `)
        .eq('auction_id', auction_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          finished_at: new Date().toISOString(),
          winner_id: lastBid?.user_id || null,
          winner_name: lastBid?.profiles?.full_name || null
        })
        .eq('id', auction_id);

      if (updateError) {
        console.error(`❌ [PROTECTION] Erro ao finalizar leilão:`, updateError);
        throw updateError;
      }

      console.log(`✅ [PROTECTION] Leilão "${title}" finalizado com sucesso`);
      return new Response(
        JSON.stringify({ 
          message: 'Leilão finalizado - meta atingida', 
          action: 'finalized',
          winner: lastBid?.profiles?.full_name || 'Desconhecido'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Meta não atingida - adicionar bid de proteção
    console.log(`🤖 [PROTECTION] Meta não atingida (R$${company_revenue}/${revenue_target}) - adicionando bid de proteção`);

    // Buscar bot aleatório
    const { data: botUser } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('is_bot', true)
      .order('random()')
      .limit(1)
      .single();

    if (!botUser) {
      console.error(`❌ [PROTECTION] Nenhum bot encontrado no sistema`);
      return new Response(
        JSON.stringify({ error: 'Nenhum bot disponível' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar bid de bot (interno - não incrementa receita)
    const { error: bidError } = await supabase
      .from('bids')
      .insert({
        auction_id: auction_id,
        user_id: botUser.user_id,
        bid_amount: auction.current_price + auction.bid_increment,
        cost_paid: 0 // Bot interno não paga
      });

    if (bidError) {
      console.error(`❌ [PROTECTION] Erro ao inserir bid de bot:`, bidError);
      throw bidError;
    }

    console.log(`🤖 [PROTECTION] Bid de proteção adicionado ao leilão "${title}"`);
    
    return new Response(
      JSON.stringify({ 
        message: 'Bid de proteção adicionado', 
        action: 'bot_bid_added',
        auction_title: title,
        revenue_status: `R$${company_revenue}/${revenue_target}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [PROTECTION] Erro crítico:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});