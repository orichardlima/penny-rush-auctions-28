import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sorteio ponderado: escolhe um índice respeitando os pesos
function weightedPickIndex(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return Math.floor(Math.random() * weights.length)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'auto_replenish_enabled',
        'auto_replenish_min_active',
        'auto_replenish_batch_size',
        'auto_replenish_interval_minutes',
        'auto_replenish_duration_min_hours',
        'auto_replenish_duration_max_hours',
        'auto_replenish_weight_standard',
        'auto_replenish_weight_premium',
        'auto_replenish_weight_luxury',
      ])

    if (settingsError) throw settingsError

    const settings: Record<string, string> = {}
    for (const s of settingsData || []) {
      settings[s.setting_key] = s.setting_value
    }

    const enabled = settings['auto_replenish_enabled'] === 'true'
    if (!enabled) {
      return new Response(JSON.stringify({ message: 'Auto-replenish disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const minActive = parseInt(settings['auto_replenish_min_active'] || '3')
    const batchSize = parseInt(settings['auto_replenish_batch_size'] || '3')
    const intervalMinutes = parseInt(settings['auto_replenish_interval_minutes'] || '30')
    const durationMinHours = parseFloat(settings['auto_replenish_duration_min_hours'] || '1')
    const durationMaxHours = parseFloat(settings['auto_replenish_duration_max_hours'] || '5')

    const tierWeights: Record<string, number> = {
      standard: parseFloat(settings['auto_replenish_weight_standard'] || '10'),
      premium: parseFloat(settings['auto_replenish_weight_premium'] || '3'),
      luxury: parseFloat(settings['auto_replenish_weight_luxury'] || '1'),
    }

    // 2. Count active + waiting auctions
    const { count, error: countError } = await supabase
      .from('auctions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'waiting'])

    if (countError) throw countError

    const currentCount = count || 0
    console.log(`Active/waiting auctions: ${currentCount}, minimum: ${minActive}`)

    if (currentCount >= minActive) {
      return new Response(JSON.stringify({ message: 'Enough auctions active', count: currentCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const needed = Math.min(minActive - currentCount, batchSize)

    // 3. Fetch active templates
    const { data: templates, error: templatesError } = await supabase
      .from('product_templates')
      .select('*')
      .eq('is_active', true)

    if (templatesError) throw templatesError

    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ message: 'No active templates found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Filtrar títulos já em uso (active/waiting)
    const { data: activeAuctions, error: activeError } = await supabase
      .from('auctions')
      .select('title')
      .in('status', ['active', 'waiting'])

    if (activeError) throw activeError

    const activeTitles = new Set((activeAuctions || []).map(a => a.title))

    // 5. Buscar últimos leilões para cooldown (qualquer status, últimas 7 dias)
    const cooldownLookbackHours = 24 * 7
    const lookbackSince = new Date(Date.now() - cooldownLookbackHours * 60 * 60 * 1000).toISOString()

    const { data: recentAuctions, error: recentError } = await supabase
      .from('auctions')
      .select('title, created_at')
      .gte('created_at', lookbackSince)

    if (recentError) throw recentError

    // Mapa: title -> created_at mais recente
    const lastSeenByTitle = new Map<string, number>()
    for (const a of recentAuctions || []) {
      const t = new Date(a.created_at).getTime()
      const prev = lastSeenByTitle.get(a.title) || 0
      if (t > prev) lastSeenByTitle.set(a.title, t)
    }

    const now = Date.now()

    // 6. Pool elegível: sem duplicatas + sem violação de cooldown
    const eligible = templates.filter(t => {
      if (activeTitles.has(t.title)) return false
      const minHours = (t as any).min_hours_between_appearances || 0
      if (minHours <= 0) return true
      const lastSeen = lastSeenByTitle.get(t.title)
      if (!lastSeen) return true
      const hoursSince = (now - lastSeen) / (60 * 60 * 1000)
      return hoursSince >= minHours
    })

    console.log(`Templates: total=${templates.length}, eligible=${eligible.length}`)

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ message: 'No eligible templates (duplicates or cooldown)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Sorteio ponderado por tier (sem reposição)
    const pool = [...eligible]
    const selected: typeof eligible = []
    const wantedCount = Math.min(needed, pool.length)

    for (let i = 0; i < wantedCount; i++) {
      const weights = pool.map(t => {
        const tier = (t as any).tier || 'standard'
        return tierWeights[tier] ?? tierWeights.standard
      })
      const idx = weightedPickIndex(weights)
      selected.push(pool[idx])
      pool.splice(idx, 1)
    }

    console.log('Selected tiers:', selected.map(t => `${(t as any).tier || 'standard'}:${t.title}`).join(' | '))

    // 8. Criar leilões com starts escalonados
    const nowDate = new Date()
    const createdAuctions: string[] = []

    for (let i = 0; i < selected.length; i++) {
      const template = selected[i]
      const startsAt = new Date(nowDate.getTime() + i * intervalMinutes * 60 * 1000)
      const randomDurationMs = (durationMinHours + Math.random() * (durationMaxHours - durationMinHours)) * 60 * 60 * 1000
      const endsAt = new Date(startsAt.getTime() + randomDurationMs)

      const auctionData = {
        title: template.title,
        description: template.description,
        image_url: template.image_url,
        market_value: template.market_value || 0,
        starting_price: template.starting_price || 1.00,
        current_price: template.starting_price || 1.00,
        bid_cost: template.bid_cost || 1.00,
        bid_increment: template.bid_increment || 0.01,
        revenue_target: template.revenue_target || 0,
        status: 'waiting',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        time_left: 15,
        total_bids: 0,
        participants_count: 0,
        company_revenue: 0,
      }

      const { data: auction, error: insertError } = await supabase
        .from('auctions')
        .insert(auctionData)
        .select('id')
        .single()

      if (insertError) {
        console.error(`Error creating auction from template ${template.id}:`, insertError)
        continue
      }

      createdAuctions.push(auction.id)

      await supabase
        .from('product_templates')
        .update({ times_used: (template.times_used || 0) + 1 })
        .eq('id', template.id)
    }

    console.log(`Created ${createdAuctions.length} auctions from templates`)

    return new Response(
      JSON.stringify({
        message: `Created ${createdAuctions.length} auctions`,
        auction_ids: createdAuctions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Auto-replenish error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
