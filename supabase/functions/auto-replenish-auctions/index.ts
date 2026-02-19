import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // 3. Calculate how many to create
    const needed = Math.min(minActive - currentCount, batchSize)

    // 4. Fetch active templates
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

    // Shuffle templates
    const shuffled = [...templates].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, needed)

    // 5. Create auctions with staggered starts
    const now = new Date()
    const createdAuctions = []

    for (let i = 0; i < selected.length; i++) {
      const template = selected[i]
      const startsAt = new Date(now.getTime() + i * intervalMinutes * 60 * 1000)
      
      // Random duration between min and max hours
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

      // Increment times_used on template
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
