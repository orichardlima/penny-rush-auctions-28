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
    console.log('🚀 [AUCTION-MONITOR] INICIANDO VERIFICAÇÃO ROBUSTA DE LEILÕES...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis de ambiente não configuradas')
    }
    
    // USANDO SERVICE_ROLE_KEY para bypass de RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    console.log('🔍 [AUCTION-MONITOR] Cliente Supabase configurado com SERVICE_ROLE_KEY')
    
    // 1. BUSCAR TODOS OS LEILÕES ATIVOS PRIMEIRO
    const { data: activeAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, title, updated_at, status, current_price, time_left')
      .eq('status', 'active')

    if (fetchError) {
      console.error('❌ [AUCTION-MONITOR] Erro ao buscar leilões ativos:', fetchError)
      throw fetchError
    }

    console.log(`📊 [AUCTION-MONITOR] LEILÕES ATIVOS ENCONTRADOS: ${activeAuctions?.length || 0}`)
    
    if (!activeAuctions || activeAuctions.length === 0) {
      console.log('ℹ️ [AUCTION-MONITOR] Nenhum leilão ativo encontrado')
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        found: 0,
        message: 'Nenhum leilão ativo para verificar'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. FILTRAR LEILÕES EXPIRADOS (15+ segundos sem lance)
    const now = new Date()
    const expiredAuctions = activeAuctions.filter(auction => {
      const updatedAt = new Date(auction.updated_at)
      const diffSeconds = (now.getTime() - updatedAt.getTime()) / 1000
      console.log(`⏰ [AUCTION-MONITOR] Leilão ${auction.id}: ${diffSeconds.toFixed(1)}s desde último lance`)
      return diffSeconds >= 15
    })

    console.log(`🔥 [AUCTION-MONITOR] LEILÕES PARA ENCERRAR: ${expiredAuctions.length}`)

    let processedCount = 0
    const results = []

    // 3. ENCERRAR CADA LEILÃO EXPIRADO
    for (const auction of expiredAuctions) {
      console.log(`🏁 [AUCTION-MONITOR] ENCERRANDO LEILÃO: ${auction.id} - ${auction.title}`)
      
      try {
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
        
        // ATUALIZAR STATUS DO LEILÃO
        const { data: updateData, error: updateError } = await supabase
          .from('auctions')
          .update({ 
            status: 'finished',
            winner_id: winnerId,
            winner_name: winnerName,
            finished_at: now.toISOString(),
            time_left: 0,
            updated_at: now.toISOString()
          })
          .eq('id', auction.id)
          .select()

        if (updateError) {
          console.error(`❌ [AUCTION-MONITOR] ERRO AO ENCERRAR ${auction.id}:`, updateError)
          results.push({ id: auction.id, success: false, error: updateError.message })
        } else {
          console.log(`✅ [AUCTION-MONITOR] LEILÃO ${auction.id} ENCERRADO COM SUCESSO! Ganhador: ${winnerName}`)
          results.push({ id: auction.id, success: true, winner: winnerName })
          processedCount++
        }
        
      } catch (auctionError) {
        console.error(`💥 [AUCTION-MONITOR] Erro ao processar leilão ${auction.id}:`, auctionError)
        results.push({ id: auction.id, success: false, error: (auctionError as Error).message })
      }
    }

    const finalResult = {
      success: true,
      processed: processedCount,
      found: expiredAuctions.length,
      total_active: activeAuctions.length,
      timestamp: now.toISOString(),
      results,
      message: `Processados ${processedCount} de ${expiredAuctions.length} leilões expirados (${activeAuctions.length} ativos no total)`
    }

    console.log('🏁 [AUCTION-MONITOR] VERIFICAÇÃO CONCLUÍDA:', finalResult)
    
    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('💥 [AUCTION-MONITOR] ERRO CRÍTICO:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro interno crítico',
      timestamp: new Date().toISOString(),
      stack: error?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})