import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Timezone do Brasil
const BRAZIL_TZ = 'America/Sao_Paulo'

// Helper para formatar data como YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// Helper para obter data/hora atual no Brasil
const getBrazilNow = (): Date => {
  const now = new Date()
  // Converter para string no timezone do Brasil e parsear de volta
  const brazilStr = now.toLocaleString('en-US', { timeZone: BRAZIL_TZ })
  return new Date(brazilStr)
}

// Helper para obter o início da semana (segunda-feira)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Ajuste para segunda-feira
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper para obter o fim da semana (domingo)
const getWeekEnd = (date: Date): Date => {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

// Helper para verificar se é domingo após 23h
const isSundayAfter23h = (date: Date): boolean => {
  return date.getDay() === 0 && date.getHours() >= 23
}

// Helper para gerar array de datas entre duas datas
const getDateRange = (start: Date, end: Date): string[] => {
  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    dates.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

interface Contract {
  id: string
  user_id: string
  plan_name: string
  aporte_value: number
  weekly_cap: number
  total_cap: number
  total_received: number
  status: string
  created_at: string
  available_balance: number
}

interface DailyRevenue {
  date: string
  percentage: number
  calculation_base: string
}

interface ProcessResult {
  contract_id: string
  user_id: string
  plan_name: string
  status: 'processed' | 'skipped' | 'error' | 'closed'
  amount?: number
  ad_center_multiplier?: number
  reason?: string
}

// Constantes da Central de Anúncios
const AD_CENTER_REQUIRED_DAYS = 5
const AD_CENTER_BASE_PERCENTAGE = 70
const AD_CENTER_BONUS_PERCENTAGE = 30

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Parse request body
    let force = false
    let weekStartOverride: string | null = null
    
    try {
      const body = await req.json()
      force = body.force === true
      weekStartOverride = body.weekStart || null
    } catch {
      // Body vazio é OK
    }

    const brazilNow = getBrazilNow()
    console.log(`[partner-weekly-payouts] Iniciando processamento. Hora Brasil: ${brazilNow.toISOString()}`)
    console.log(`[partner-weekly-payouts] Force: ${force}, WeekStartOverride: ${weekStartOverride}`)

    // Verificar se é domingo após 23h (ou force=true)
    if (!force && !isSundayAfter23h(brazilNow)) {
      console.log('[partner-weekly-payouts] Não é domingo após 23h e force=false. Abortando.')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Processamento só ocorre domingo após 23h. Use force=true para executar manualmente.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Calcular período da semana
    let weekStart: Date
    let weekEnd: Date
    
    if (weekStartOverride) {
      // Usar data fornecida
      weekStart = new Date(weekStartOverride + 'T00:00:00')
      weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
    } else {
      // Usar semana atual
      weekStart = getWeekStart(brazilNow)
      weekEnd = getWeekEnd(brazilNow)
    }

    const weekStartStr = formatDate(weekStart)
    const weekEndStr = formatDate(weekEnd)
    
    console.log(`[partner-weekly-payouts] Período: ${weekStartStr} a ${weekEndStr}`)

    // Buscar todos os contratos ativos
    const { data: contracts, error: contractsError } = await supabase
      .from('partner_contracts')
      .select('*')
      .eq('status', 'ACTIVE')

    if (contractsError) {
      console.error('[partner-weekly-payouts] Erro ao buscar contratos:', contractsError)
      throw contractsError
    }

    if (!contracts || contracts.length === 0) {
      console.log('[partner-weekly-payouts] Nenhum contrato ativo encontrado.')
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum contrato ativo para processar.', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[partner-weekly-payouts] ${contracts.length} contratos ativos encontrados.`)

    // Buscar configuração de rendimentos diários da semana
    const { data: dailyRevenues, error: revenueError } = await supabase
      .from('daily_revenue_config')
      .select('date, percentage, calculation_base')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .order('date')

    if (revenueError) {
      console.error('[partner-weekly-payouts] Erro ao buscar daily_revenue_config:', revenueError)
      throw revenueError
    }

    console.log(`[partner-weekly-payouts] ${dailyRevenues?.length || 0} configurações de rendimento encontradas.`)

    // Mapear rendimentos por data
    const revenueByDate = new Map<string, DailyRevenue>()
    dailyRevenues?.forEach(r => {
      revenueByDate.set(r.date, r as DailyRevenue)
    })

    // Processar cada contrato
    const results: ProcessResult[] = []
    
    for (const contract of contracts as Contract[]) {
      console.log(`[partner-weekly-payouts] Processando contrato ${contract.id} (${contract.plan_name})`)
      
      try {
        // 1. Verificar idempotência - já existe payout para esta semana?
        const { data: existingPayout, error: existingError } = await supabase
          .from('partner_payouts')
          .select('id')
          .eq('partner_contract_id', contract.id)
          .eq('period_start', weekStartStr)
          .maybeSingle()

        if (existingError) {
          console.error(`[partner-weekly-payouts] Erro ao verificar payout existente:`, existingError)
          throw existingError
        }

        if (existingPayout) {
          console.log(`[partner-weekly-payouts] Contrato ${contract.id} já tem payout para ${weekStartStr}. Pulando.`)
          results.push({
            contract_id: contract.id,
            user_id: contract.user_id,
            plan_name: contract.plan_name,
            status: 'skipped',
            reason: 'Payout já existe para este período'
          })
          continue
        }

        // 2. Aplicar Pro Rata - ignorar dias antes da criação do contrato
        const contractCreatedDate = new Date(contract.created_at)
        contractCreatedDate.setHours(0, 0, 0, 0)
        
        // Data efetiva de início (maior entre início da semana e criação do contrato)
        const effectiveStart = contractCreatedDate > weekStart ? contractCreatedDate : weekStart
        
        if (effectiveStart > weekEnd) {
          console.log(`[partner-weekly-payouts] Contrato ${contract.id} criado após fim da semana. Pulando.`)
          results.push({
            contract_id: contract.id,
            user_id: contract.user_id,
            plan_name: contract.plan_name,
            status: 'skipped',
            reason: 'Contrato criado após o período'
          })
          continue
        }

        // 3. Calcular rendimento total da semana (Pro Rata)
        const eligibleDates = getDateRange(effectiveStart, weekEnd)
        let totalPercentage = 0
        
        for (const dateStr of eligibleDates) {
          const revenue = revenueByDate.get(dateStr)
          if (revenue) {
            totalPercentage += Number(revenue.percentage)
          }
        }

        console.log(`[partner-weekly-payouts] Contrato ${contract.id}: ${eligibleDates.length} dias elegíveis, ${totalPercentage}% total`)

        if (totalPercentage === 0) {
          console.log(`[partner-weekly-payouts] Contrato ${contract.id} sem rendimento configurado. Pulando.`)
          results.push({
            contract_id: contract.id,
            user_id: contract.user_id,
            plan_name: contract.plan_name,
            status: 'skipped',
            reason: 'Sem rendimento configurado para o período'
          })
          continue
        }

        // 4. Calcular valor do repasse baseado no aporte
        const calculatedAmount = (contract.aporte_value * totalPercentage) / 100
        
        // 5. Verificar teto semanal
        const weeklyCapApplied = calculatedAmount > contract.weekly_cap
        let amountAfterWeeklyCap = weeklyCapApplied ? contract.weekly_cap : calculatedAmount

        // 6. Verificar teto total
        const remainingCap = contract.total_cap - contract.total_received
        const totalCapApplied = amountAfterWeeklyCap > remainingCap
        let amountAfterCaps = totalCapApplied ? remainingCap : amountAfterWeeklyCap

        // 7. Buscar confirmações da Central de Anúncios para esta semana
        const { count: adCenterCompletions, error: adCenterError } = await supabase
          .from('ad_center_completions')
          .select('*', { count: 'exact', head: true })
          .eq('partner_contract_id', contract.id)
          .gte('completion_date', weekStartStr)
          .lte('completion_date', weekEndStr)

        if (adCenterError) {
          console.error(`[partner-weekly-payouts] Erro ao buscar ad_center_completions:`, adCenterError)
          // Continua sem aplicar desconto da central de anúncios
        }

        // 8. Calcular multiplicador de desbloqueio da Central de Anúncios
        const completedAdDays = adCenterCompletions || 0
        const effectiveAdDays = Math.min(completedAdDays, AD_CENTER_REQUIRED_DAYS)
        const adCenterUnlockPercentage = AD_CENTER_BASE_PERCENTAGE + (AD_CENTER_BONUS_PERCENTAGE * effectiveAdDays / AD_CENTER_REQUIRED_DAYS)
        const adCenterMultiplier = adCenterUnlockPercentage / 100

        // 9. Aplicar multiplicador da Central de Anúncios
        const finalAmount = Math.round(amountAfterCaps * adCenterMultiplier * 100) / 100

        console.log(`[partner-weekly-payouts] Contrato ${contract.id}: Calculado=${calculatedAmount.toFixed(2)}, AposCaps=${amountAfterCaps.toFixed(2)}, AdCenter=${completedAdDays}/${AD_CENTER_REQUIRED_DAYS} dias (${adCenterUnlockPercentage.toFixed(0)}%), Final=${finalAmount.toFixed(2)}`)

        if (finalAmount <= 0) {
          console.log(`[partner-weekly-payouts] Contrato ${contract.id} já atingiu teto total. Fechando.`)
          
          // Fechar contrato
          await supabase
            .from('partner_contracts')
            .update({
              status: 'CLOSED',
              closed_at: new Date().toISOString(),
              closed_reason: 'Teto total atingido'
            })
            .eq('id', contract.id)
          
          results.push({
            contract_id: contract.id,
            user_id: contract.user_id,
            plan_name: contract.plan_name,
            status: 'closed',
            reason: 'Teto total atingido'
          })
          continue
        }

        // 10. Criar registro de payout
        const { error: payoutError } = await supabase
          .from('partner_payouts')
          .insert({
            partner_contract_id: contract.id,
            period_start: weekStartStr,
            period_end: weekEndStr,
            calculated_amount: amountAfterCaps, // Valor antes do desconto da Central
            amount: finalAmount, // Valor final com desconto aplicado
            weekly_cap_applied: weeklyCapApplied,
            total_cap_applied: totalCapApplied,
            status: 'PAID',
            paid_at: new Date().toISOString()
          })

        if (payoutError) {
          console.error(`[partner-weekly-payouts] Erro ao criar payout:`, payoutError)
          throw payoutError
        }

        // 11. Atualizar contrato
        const newTotalReceived = contract.total_received + amountAfterCaps
        const newAvailableBalance = contract.available_balance + finalAmount
        const shouldClose = newTotalReceived >= contract.total_cap

        const updateData: any = {
          total_received: newTotalReceived,
          available_balance: newAvailableBalance
        }

        if (shouldClose) {
          updateData.status = 'CLOSED'
          updateData.closed_at = new Date().toISOString()
          updateData.closed_reason = 'Teto total atingido'
        }

        const { error: updateError } = await supabase
          .from('partner_contracts')
          .update(updateData)
          .eq('id', contract.id)

        if (updateError) {
          console.error(`[partner-weekly-payouts] Erro ao atualizar contrato:`, updateError)
          throw updateError
        }

        results.push({
          contract_id: contract.id,
          user_id: contract.user_id,
          plan_name: contract.plan_name,
          status: shouldClose ? 'closed' : 'processed',
          amount: finalAmount,
          ad_center_multiplier: adCenterMultiplier,
          reason: shouldClose ? 'Processado e fechado (teto atingido)' : undefined
        })

        console.log(`[partner-weekly-payouts] Contrato ${contract.id} processado com sucesso. Valor: R$ ${finalAmount.toFixed(2)} (AdCenter: ${adCenterUnlockPercentage.toFixed(0)}%)`)

      } catch (error) {
        console.error(`[partner-weekly-payouts] Erro ao processar contrato ${contract.id}:`, error)
        results.push({
          contract_id: contract.id,
          user_id: contract.user_id,
          plan_name: contract.plan_name,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Erro desconhecido'
        })
      }
    }

    // Resumo
    const processed = results.filter(r => r.status === 'processed').length
    const closed = results.filter(r => r.status === 'closed').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors = results.filter(r => r.status === 'error').length
    const totalDistributed = results
      .filter(r => r.amount)
      .reduce((sum, r) => sum + (r.amount || 0), 0)

    console.log(`[partner-weekly-payouts] Finalizado. Processados: ${processed}, Fechados: ${closed}, Pulados: ${skipped}, Erros: ${errors}`)
    console.log(`[partner-weekly-payouts] Total distribuído: R$ ${totalDistributed.toFixed(2)}`)

    return new Response(
      JSON.stringify({
        success: true,
        period: { start: weekStartStr, end: weekEndStr },
        summary: {
          total_contracts: contracts.length,
          processed,
          closed,
          skipped,
          errors,
          total_distributed: totalDistributed
        },
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[partner-weekly-payouts] Erro geral:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
