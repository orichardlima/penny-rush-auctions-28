import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔍 [AUCTION-MONITOR] Iniciando verificação definitiva de leilões...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    // LÓGICA SIMPLES: Buscar leilões ativos há mais de 15 segundos
    const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString()
    
    console.log(`⏰ [AUCTION-MONITOR] Verificando leilões ativos antes de: ${fifteenSecondsAgo}`)
    
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, title, updated_at, status')
      .eq('status', 'active')
      .lt('updated_at', fifteenSecondsAgo)

    if (fetchError) {
      console.error('❌ [AUCTION-MONITOR] Erro ao buscar leilões:', fetchError)
      throw fetchError
    }

    console.log(`📊 [AUCTION-MONITOR] Encontrados ${expiredAuctions?.length || 0} leilões expirados`)

    let processedCount = 0

    // Encerrar cada leilão expirado
    if (expiredAuctions && expiredAuctions.length > 0) {
      for (const auction of expiredAuctions) {
        console.log(`🎯 [AUCTION-MONITOR] Encerrando leilão: ${auction.id} - ${auction.title}`)
        
        // Buscar último lance para determinar ganhador
        const { data: lastBid } = await supabase
          .from('bids')
          .select('user_id, profiles(full_name)')
          .eq('auction_id', auction.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        let winnerName = 'Nenhum ganhador'
        let winnerId = null
        
        if (lastBid) {
          winnerId = lastBid.user_id
          const profile = lastBid.profiles as any
          winnerName = profile?.full_name || `Usuário ${lastBid.user_id.substring(0, 8)}`
        }
        
        const { error: updateError } = await supabase
          .from('auctions')
          .update({ 
            status: 'finished',
            winner_id: winnerId,
            winner_name: winnerName,
            finished_at: new Date().toISOString(),
            time_left: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', auction.id)

        if (updateError) {
          console.error(`❌ [AUCTION-MONITOR] Erro ao encerrar leilão ${auction.id}:`, updateError)
        } else {
          console.log(`✅ [AUCTION-MONITOR] Leilão ${auction.id} encerrado! Ganhador: ${winnerName}`)
          processedCount++
        }
      }
    }

    const result = {
      success: true,
      processed: processedCount,
      found: expiredAuctions?.length || 0,
      timestamp: new Date().toISOString(),
      message: `Processados ${processedCount} de ${expiredAuctions?.length || 0} leilões expirados`
    }

    console.log('🏁 [AUCTION-MONITOR] Verificação concluída:', result)
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('💥 [AUCTION-MONITOR] Erro crítico:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro interno',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})