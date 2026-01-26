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

    const { company_revenue, revenue_target, title, current_price, market_value, ends_at, max_price } = auction;

    console.log(`💰 [PROTECTION] Receita atual: R$${company_revenue} | Meta: R$${revenue_target}`);
    console.log(`🏪 [PROTECTION] Preço atual: R$${current_price} | Valor loja: R$${market_value}`);
    if (ends_at) console.log(`⏰ [PROTECTION] Horário limite: ${ends_at}`);
    if (max_price) console.log(`💲 [PROTECTION] Preço máximo: R$${max_price}`);

    // Verificar se horário limite foi atingido
    if (ends_at) {
      const endsAtTime = new Date(ends_at);
      const now = new Date();
      if (now >= endsAtTime) {
        console.log(`⏰ [PROTECTION] Horário limite atingido para "${title}"`);
        
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

        console.log(`✅ [PROTECTION] Leilão "${title}" finalizado por horário limite`);
        return new Response(
          JSON.stringify({ 
            message: 'Leilão finalizado - horário limite atingido', 
            action: 'finalized_time_limit',
            winner: lastBid?.profiles?.full_name || 'Desconhecido'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verificar se preço máximo foi atingido
    if (max_price && current_price >= max_price) {
      console.log(`💲 [PROTECTION] Preço máximo atingido para "${title}" (R$${current_price} >= R$${max_price})`);
      
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

      console.log(`✅ [PROTECTION] Leilão "${title}" finalizado por preço máximo`);
      return new Response(
        JSON.stringify({ 
          message: 'Leilão finalizado - preço máximo atingido', 
          action: 'finalized_max_price',
          winner: lastBid?.profiles?.full_name || 'Desconhecido'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // NOVA REGRA: Verificar se preço atual > valor da loja
    if (current_price > market_value && company_revenue < revenue_target) {
      console.log(`⚠️ [PROTECTION] Preço ultrapassou valor da loja! Verificando último lance...`);
      
      // Buscar último lance para verificar se foi de bot
      const { data: lastBid } = await supabase
        .from('bids')
        .select(`
          user_id,
          cost_paid,
          bid_amount,
          profiles!inner(full_name, is_bot)
        `)
        .eq('auction_id', auction_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastBid && lastBid.profiles?.is_bot) {
        // Último lance foi de bot - FINALIZAR leilão para evitar prejuízo
        console.log(`🛑 [PROTECTION] Último lance foi de bot - finalizando para evitar prejuízo`);
        
        const { error: finalizeError } = await supabase
          .from('auctions')
          .update({
            status: 'finished',
            finished_at: new Date().toISOString(),
            winner_id: lastBid.user_id,
            winner_name: lastBid.profiles.full_name || 'Bot'
          })
          .eq('id', auction_id);

        if (finalizeError) {
          console.error(`❌ [PROTECTION] Erro ao finalizar leilão:`, finalizeError);
          throw finalizeError;
        }

        console.log(`✅ [PROTECTION] Leilão "${title}" finalizado - proteção contra prejuízo`);
        return new Response(
          JSON.stringify({ 
            message: 'Leilão finalizado - proteção contra prejuízo', 
            action: 'finalized_loss_protection',
            auction_title: title,
            reason: 'Preço > valor loja + último lance de bot',
            winner: lastBid.profiles.full_name || 'Bot'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (lastBid && !lastBid.profiles?.is_bot) {
        console.log(`👤 [PROTECTION] Último lance foi de usuário - adicionando bid de proteção`);
        // Continuar para lógica normal de proteção (adicionar bid de bot)
      } else {
        console.log(`❓ [PROTECTION] Nenhum lance encontrado - continuando proteção normal`);
        // Continuar para lógica normal de proteção
      }
    }

    // Meta não atingida - adicionar bid de proteção
    console.log(`🤖 [PROTECTION] Meta não atingida (R$${company_revenue}/${revenue_target}) - adicionando bid de proteção`);

    // Buscar bot aleatório - com fallback para admin se não houver bots
    const { data: botUser } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('is_bot', true)
      .order('random()')
      .limit(1)
      .single();

    let selectedUserId = botUser?.user_id;

    if (!botUser) {
      console.log(`⚠️ [PROTECTION] Nenhum bot encontrado - usando fallback admin`);
      
      // Fallback: usar admin como bot temporário
      const { data: adminUser } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('is_admin', true)
        .limit(1)
        .single();
      
      if (!adminUser) {
        console.log(`❌ [PROTECTION] Nenhum admin encontrado - finalizando leilão sem proteção`);
        
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

        // Finalizar leilão mesmo sem atingir meta
        const { error: finalizeError } = await supabase
          .from('auctions')
          .update({
            status: 'finished',
            finished_at: new Date().toISOString(),
            winner_id: lastBid?.user_id || null,
            winner_name: lastBid?.profiles?.full_name || null
          })
          .eq('id', auction_id);

        if (finalizeError) {
          console.error(`❌ [PROTECTION] Erro ao finalizar leilão:`, finalizeError);
          throw finalizeError;
        }

        console.log(`🏁 [PROTECTION] Leilão "${title}" finalizado sem proteção (sem usuários disponíveis)`);
        return new Response(
          JSON.stringify({ 
            message: 'Leilão finalizado sem proteção', 
            action: 'finalized_without_protection',
            auction_title: title,
            winner: lastBid?.profiles?.full_name || 'Desconhecido'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      selectedUserId = adminUser.user_id;
      console.log(`🔧 [PROTECTION] Usando admin como bot: ${selectedUserId}`);
    } else {
      console.log(`🤖 [PROTECTION] Bot encontrado: ${botUser.full_name || botUser.user_id}`);
    }

    // Adicionar bid de proteção (não incrementa receita da empresa)
    const { error: bidError } = await supabase
      .from('bids')
      .insert({
        auction_id: auction_id,
        user_id: selectedUserId,
        bid_amount: auction.current_price + auction.bid_increment,
        cost_paid: 0 // Bot/proteção não paga - não incrementa receita
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